import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'agent.env').write_text('PANEL_URL="http://127.0.0.1"\nTOKEN="test-token"')
        (self.root / 'config.json').write_text('{"old":true}')
        (self.root / 'config_version').write_text('1')
        self.environment = patch.dict(os.environ, {'NODEMASTER_AGENT_DIR': self.temp.name})
        self.environment.start()
        spec = importlib.util.spec_from_file_location('probe_under_test', Path(__file__).parent.parent / 'data' / 'probe.py')
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.module.SERVICE_FILE = self.root / 'service'
        self.module.SERVICE_FILE.touch()
        self.probe = self.module.Probe()
        self.response = {'proxyAction': 'RUN', 'sync': {'targetVersion': 2, 'configUrl': '/api/config'}}

    def tearDown(self):
        self.probe.executor.shutdown(wait=True)
        self.environment.stop()
        self.temp.cleanup()

    def test_config_success_acknowledges_only_after_restart(self):
        with patch.object(self.module, 'request', return_value={'data': {'new': True}}), patch.object(self.module, 'command', return_value='') as command, patch.object(self.module.time, 'sleep'):
            self.probe.apply(self.response)
        self.assertEqual(self.probe.applied, 2)
        self.assertEqual((self.root / 'config_version').read_text(), '2')
        self.assertEqual(self.probe.sync_report['status'], 'success')
        self.assertIn(unittest.mock.call(['systemctl', 'is-active', '--quiet', 'nodemaster-proxy']), command.call_args_list)

    def test_invalid_config_does_not_replace_running_configuration(self):
        with patch.object(self.module, 'request', return_value={'data': {'invalid': True}}), patch.object(self.module, 'command', side_effect=RuntimeError('invalid config')):
            self.probe.apply(self.response)
        self.assertEqual(self.probe.applied, 1)
        self.assertEqual(json.loads((self.root / 'config.json').read_text()), {'old': True})
        self.assertEqual(self.probe.sync_report['status'], 'error')

    def test_restart_failure_rolls_back_without_success_ack(self):
        def command(args, **kwargs):
            if args[:2] == ['systemctl', 'restart']:
                raise RuntimeError('restart failed')
            return ''
        with patch.object(self.module, 'request', return_value={'data': {'new': True}}), patch.object(self.module, 'command', side_effect=command), patch.object(self.module.subprocess, 'run'):
            self.probe.apply(self.response)
        self.assertEqual(self.probe.applied, 1)
        self.assertEqual(json.loads((self.root / 'config.json').read_text()), {'old': True})
        self.assertEqual(self.probe.sync_report['status'], 'error')

    def test_breaker_stops_service_and_never_restarts_it(self):
        with patch.object(self.module, 'request', return_value={'data': {'inbounds': []}}), patch.object(self.module, 'command', return_value='') as command:
            self.probe.apply({**self.response, 'proxyAction': 'STOP'})
        self.assertTrue((self.root / 'circuit-broken').exists())
        self.assertIn(unittest.mock.call(['systemctl', 'stop', 'nodemaster-proxy']), command.call_args_list)
        self.assertNotIn(unittest.mock.call(['systemctl', 'restart', 'nodemaster-proxy']), command.call_args_list)

    def test_upgrade_invalid_version_reports_failure_without_execution(self):
        with patch.object(self.module.subprocess, 'run') as run:
            result = self.probe.perform_upgrade({'version': 'v1;bad', 'scriptUrl': '/api/xray/upgrade.sh'})
        self.assertEqual(result['status'], 'error')
        run.assert_not_called()

    def test_latency_timeout_is_measured_as_packet_loss(self):
        with patch.object(self.module.socket, 'create_connection', side_effect=TimeoutError):
            value = self.module.measure_latency({'id': 'test', 'target': '127.0.0.1:1', 'type': 'tcp'})
        self.assertEqual(value['lossRate'], 100)
        self.assertEqual(value['latencyMs'], 0)


if __name__ == '__main__':
    unittest.main()
