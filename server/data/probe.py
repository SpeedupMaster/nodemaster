#!/usr/bin/env python3
"""NodeMaster system probe. Python standard library only; no simulated metrics."""
import concurrent.futures
import json
import os
import pathlib
import re
import socket
import subprocess
import time
import urllib.request

ROOT = pathlib.Path(os.environ.get('NODEMASTER_AGENT_DIR', '/etc/nodemaster'))
ENV = dict(line.split('=', 1) for line in (ROOT / 'agent.env').read_text().splitlines() if '=' in line)
PANEL = ENV['PANEL_URL'].strip('"').rstrip('/')
TOKEN = ENV['TOKEN'].strip('"')
SERVICE = 'nodemaster-proxy'
XRAY = '/usr/local/bin/xray'
BOOT = pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip() if pathlib.Path('/proc/sys/kernel/random/boot_id').exists() else 'unsupported-platform'
SERVICE_FILE = pathlib.Path('/etc/systemd/system/nodemaster-proxy.service')


def command(args, timeout=15):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout or 'Command failed')[-300:])
    return result.stdout.strip()


def request(path, body=None):
    if not path.startswith('/api/') or path.startswith('//'):
        raise ValueError('Invalid API path')
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(PANEL + path, payload, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=12) as response:
        return json.load(response)


def atomic_text(path, value):
    temporary = path.with_suffix(path.suffix + '.new')
    with temporary.open('w') as stream:
        stream.write(value)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)


def read_version():
    try:
        match = re.search(r'\b(\d+\.\d+\.\d+)\b', command([XRAY, 'version']))
        return 'v' + match.group(1) if match else ''
    except Exception:
        return ''


def measure_latency(task):
    started = time.monotonic()
    try:
        target = task['target']
        if task['type'] == 'tcp':
            host, port = target.rsplit(':', 1)
            with socket.create_connection((host.strip('[]'), int(port)), timeout=3):
                pass
            latency = (time.monotonic() - started) * 1000
        else:
            if not re.fullmatch(r'[a-zA-Z0-9.:-]+', target) or target.startswith('-'):
                raise ValueError('Invalid ICMP target')
            output = command(['ping', '-n', '-c', '1', '-W', '3', target], timeout=5)
            match = re.search(r'time[=<]([\d.]+)', output)
            if not match:
                raise RuntimeError('No ICMP measurement')
            latency = float(match.group(1))
        return {'taskId': task['id'], 'latencyMs': round(latency, 2), 'lossRate': 0, 'jitter': 0}
    except Exception:
        return {'taskId': task['id'], 'latencyMs': 0, 'lossRate': 100, 'jitter': 0}


class Probe:
    def __init__(self):
        self.previous = None
        self.applied = int((ROOT / 'config_version').read_text()) if (ROOT / 'config_version').exists() else 0
        self.sync_report = None
        self.upgrade_report = None
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)
        self.pending = {}
        self.task_times = {}
        self.last_latency = {}
        self.latency_results = []
        self.upgrade_future = None

    def perform_upgrade(self, upgrade):
        version = upgrade['version']
        try:
            if not re.fullmatch(r'v\d+\.\d+\.\d+', version): raise ValueError('Invalid version')
            script_path = upgrade['scriptUrl']
            if not script_path.startswith('/api/xray/upgrade.sh?'): raise ValueError('Invalid upgrade URL')
            with urllib.request.urlopen(PANEL + script_path, timeout=20) as source:
                script = source.read(1024 * 1024).decode()
            result = subprocess.run(['bash'], input=script, text=True, capture_output=True, timeout=180)
            if result.returncode or read_version() != version: raise RuntimeError('Upgrade failed: ' + result.stderr[-300:])
            return {'status': 'success', 'version': version}
        except Exception as error:
            return {'status': 'error', 'version': version, 'error': str(error)}

    def metrics(self):
        now = time.monotonic()
        cpu = [int(v) for v in pathlib.Path('/proc/stat').read_text().splitlines()[0].split()[1:9]]
        total, idle = sum(cpu), cpu[3] + cpu[4]
        memory = {line.split(':')[0]: int(line.split()[1]) * 1024 for line in pathlib.Path('/proc/meminfo').read_text().splitlines()}
        rx = tx = 0
        for line in pathlib.Path('/proc/net/dev').read_text().splitlines()[2:]:
            name, values = line.split(':', 1)
            # Avoid counting loopback and container/tunnel traffic twice.
            if name.strip() == 'lo' or not pathlib.Path('/sys/class/net', name.strip(), 'device').exists():
                continue
            values = values.split()
            rx += int(values[0]); tx += int(values[8])
        cpu_usage = up = down = 0
        if self.previous:
            old_time, old_total, old_idle, old_rx, old_tx = self.previous
            elapsed = max(0.001, now - old_time)
            cpu_usage = max(0, min(100, 100 * (1 - (idle - old_idle) / max(1, total - old_total))))
            up, down = max(0, tx - old_tx) / elapsed, max(0, rx - old_rx) / elapsed
        self.previous = now, total, idle, rx, tx
        disk = os.statvfs('/')
        disk_total = disk.f_blocks * disk.f_frsize
        disk_used = (disk.f_blocks - disk.f_bfree) * disk.f_frsize
        mem_used = memory['MemTotal'] - memory.get('MemAvailable', memory.get('MemFree', 0))
        os_name = 'Linux'
        for line in pathlib.Path('/etc/os-release').read_text().splitlines() if pathlib.Path('/etc/os-release').exists() else []:
            if line.startswith('PRETTY_NAME='): os_name = line.split('=', 1)[1].strip('"')
        def connections(names):
            return sum(max(0, len(pathlib.Path('/proc/net', name).read_text().splitlines()) - 1) for name in names if pathlib.Path('/proc/net', name).exists())
        return {
            'token': TOKEN, 'bootId': BOOT, 'sequence': time.monotonic_ns() // 1000000,
            'networkRxBytes': rx, 'networkTxBytes': tx, 'cpuUsage': cpu_usage,
            'memTotalBytes': memory['MemTotal'], 'memUsedBytes': mem_used, 'memUsage': mem_used / memory['MemTotal'] * 100,
            'diskTotalBytes': disk_total, 'diskUsedBytes': disk_used, 'diskUsage': disk_used / max(1, disk_total) * 100,
            'uplinkSpeedBytes': up, 'downlinkSpeedBytes': down, 'loadAvg': list(os.getloadavg()),
            'uptime': str(int(float(pathlib.Path('/proc/uptime').read_text().split()[0]))) + ' 秒',
            'os': os_name, 'arch': os.uname().machine, 'tcpCount': connections(['tcp', 'tcp6']), 'udpCount': connections(['udp', 'udp6']),
            'xrayVersion': read_version(), 'appliedConfigVersion': self.applied,
            'syncReport': self.sync_report, 'upgradeReport': self.upgrade_report, 'latencyResults': self.latency_results,
        }

    def apply(self, response):
        stop = response.get('proxyAction') == 'STOP'
        marker = ROOT / 'circuit-broken'
        installed = SERVICE_FILE.exists()
        if stop and installed:
            marker.touch(mode=0o600)
            command(['systemctl', 'stop', SERVICE])
        sync = response.get('sync')
        if sync and installed and self.upgrade_future is None:
            target = int(sync['targetVersion'])
            try:
                config = request(sync['configUrl'])['data']
                candidate = ROOT / 'config.pending.json'
                atomic_text(candidate, json.dumps(config))
                command([XRAY, 'run', '-test', '-c', str(candidate)])
                current = ROOT / 'config.json'
                backup = current.read_text() if current.exists() else None
                candidate.replace(current)
                try:
                    if not stop:
                        if marker.exists(): marker.unlink()
                        command(['systemctl', 'restart', SERVICE])
                        time.sleep(1)
                        command(['systemctl', 'is-active', '--quiet', SERVICE])
                except Exception:
                    if backup is not None:
                        atomic_text(current, backup)
                        subprocess.run(['systemctl', 'restart', SERVICE], timeout=15, check=False)
                    raise
                self.applied = target
                atomic_text(ROOT / 'config_version', str(target))
                self.sync_report = {'status': 'success', 'version': target}
            except Exception as error:
                self.sync_report = {'status': 'error', 'version': target, 'error': str(error)}
        elif not stop and installed and marker.exists():
            # A reset must be accompanied by an applied configuration before reopening.
            marker.unlink()
            command(['systemctl', 'start', SERVICE])
        upgrade = response.get('upgrade')
        if upgrade and installed and self.upgrade_future is None:
            self.upgrade_future = self.executor.submit(self.perform_upgrade, upgrade)
        now = time.monotonic()
        for task in response.get('latencyTasks', [])[:100]:
            key = task['id']
            if key not in self.pending and len(self.pending) < 4 and now - self.task_times.get(key, -86400) >= max(10, task['intervalSec']):
                self.task_times[key] = now
                self.pending[key] = self.executor.submit(measure_latency, task)

    def run(self):
        while True:
            try:
                if self.upgrade_future is not None and self.upgrade_future.done():
                    self.upgrade_report = self.upgrade_future.result()
                    self.upgrade_future = None
                for key, future in list(self.pending.items()):
                    if future.done():
                        measurement = future.result()
                        previous = self.last_latency.get(key)
                        if previous is not None and measurement['lossRate'] == 0: measurement['jitter'] = abs(measurement['latencyMs'] - previous)
                        if measurement['lossRate'] == 0: self.last_latency[key] = measurement['latencyMs']
                        self.latency_results.append(measurement)
                        del self.pending[key]
                response = request('/api/nodes/telemetry', self.metrics())
                if not response.get('success'): raise RuntimeError('Telemetry rejected')
                self.latency_results = []
                self.sync_report = self.upgrade_report = None
                self.apply(response)
            except Exception as error:
                print('Probe error:', error, flush=True)
            time.sleep(3)


if __name__ == '__main__':
    Probe().run()
