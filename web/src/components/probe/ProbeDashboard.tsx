import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { NodeItem } from "../../types";
import { Badge } from "../common/Badge";
import { RollingCounter } from "../common/RollingCounter";
import { Input } from "../common/Input";
import {
  Cpu,
  HardDrive,
  Globe,
  ArrowUp,
  ArrowDown,
  Clock,
  ArrowsClockwise,
  ListBullets,
  SquaresFour,
  MagnifyingGlass,
  Sparkle,
  Database,
  Lightning,
  ShieldCheck,
} from "@phosphor-icons/react";

gsap.registerPlugin(useGSAP);

interface ProbeDashboardProps {
  nodes: NodeItem[];
}

export const ProbeDashboard: React.FC<ProbeDashboardProps> = ({ nodes }) => {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const formatSpeed = (bytes: number) => {
    if (bytes > 1024 * 1024) return { val: bytes / (1024 * 1024), unit: "MB/s" };
    return { val: bytes / 1024, unit: "KB/s" };
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 B";
    if (bytes >= 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB`;
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const filteredNodes = nodes.filter((node) => {
    const matchSearch =
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.ip.includes(search) ||
      node.countryName.toLowerCase().includes(search.toLowerCase()) ||
      node.os?.toLowerCase().includes(search.toLowerCase()) ||
      node.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;
    if (regionFilter === "all") return true;
    if (regionFilter === "asia") return ["HK", "JP", "SG", "TW", "KR"].includes(node.country);
    if (regionFilter === "west") return ["US", "GB", "DE", "FR", "NL"].includes(node.country);
    return true;
  });

  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      ".probe-item-anim",
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.25, ease: "power2.out" }
    );
  }, { scope: containerRef, dependencies: [viewMode, regionFilter] });

  // Calculate Aggregates
  const totalUpBytes = nodes.reduce((acc, n) => acc + (n.status === "online" ? n.uplinkSpeedBytes : 0), 0);
  const totalDownBytes = nodes.reduce((acc, n) => acc + (n.status === "online" ? n.downlinkSpeedBytes : 0), 0);
  const totalMemTotal = nodes.reduce((acc, n) => acc + (n.memTotalBytes || 2147483648), 0);
  const totalMemUsed = nodes.reduce((acc, n) => acc + (n.memUsedBytes || Math.floor((n.memTotalBytes || 2147483648) * (n.memUsage / 100))), 0);
  const avgCpu = (nodes.reduce((acc, n) => acc + n.cpuUsage, 0) / (nodes.length || 1)).toFixed(1);
  const onlineCount = nodes.filter((n) => n.status === "online").length;

  const aggUp = formatSpeed(totalUpBytes);
  const aggDown = formatSpeed(totalDownBytes);

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Probe Telemetry Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-paper-2 border border-rule flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-ink-muted">在管探针总数</div>
            <div className="text-lg font-bold font-mono text-ink mt-0.5 flex items-center gap-1.5">
              <span>{onlineCount}</span>
              <span className="text-xs text-ink-muted font-normal">/ {nodes.length} 在线</span>
            </div>
          </div>
          <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-paper-2 border border-rule flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-ink-muted">全网出入吞吐</div>
            <div className="text-sm font-bold font-mono text-ink mt-1 flex items-center gap-2">
              <span className="text-emerald-400 flex items-center gap-0.5">
                <ArrowDown className="w-3 h-3" />
                <RollingCounter value={aggDown.val} decimals={1} suffix={` ${aggDown.unit}`} />
              </span>
              <span className="text-sky-400 flex items-center gap-0.5">
                <ArrowUp className="w-3 h-3" />
                <RollingCounter value={aggUp.val} decimals={1} suffix={` ${aggUp.unit}`} />
              </span>
            </div>
          </div>
          <div className="p-2 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Lightning className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-paper-2 border border-rule flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-ink-muted">全网平均 CPU 负载</div>
            <div className="text-lg font-bold font-mono text-ink mt-0.5">
              {avgCpu}%
            </div>
          </div>
          <div className="p-2 rounded-md bg-accent/10 text-accent border border-accent/20">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-paper-2 border border-rule flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-ink-muted">物理内存总占用</div>
            <div className="text-sm font-bold font-mono text-ink mt-1">
              {formatBytes(totalMemUsed)} / {formatBytes(totalMemTotal)}
            </div>
          </div>
          <div className="p-2 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <Database className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar: Filter, Search & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-paper-2 p-3 rounded-lg border border-rule">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Region Tabs */}
          <div className="flex items-center gap-1 bg-paper p-1 rounded-md border border-rule">
            {[
              { id: "all", label: "全部探针" },
              { id: "asia", label: "亚太地区" },
              { id: "west", label: "欧美地区" },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRegionFilter(r.id)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                  regionFilter === r.id
                    ? "bg-paper-2 text-ink shadow-sm border border-rule"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-ink-muted font-mono pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>实时探针心跳 (3s 采样)</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="w-full sm:w-56">
            <Input
              prefixIcon={<MagnifyingGlass className="w-3.5 h-3.5" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索主机、IP 或系统..."
            />
          </div>

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center gap-0.5 bg-paper p-0.5 rounded-md border border-rule shrink-0">
            <button
              onClick={() => setViewMode("table")}
              title="表格列表模式 (ServerStatus 风格)"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-paper-2 text-accent border border-rule shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <ListBullets className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="矩阵卡片模式"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-paper-2 text-accent border border-rule shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <SquaresFour className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Mode 1: Nezha / ServerStatus Style High-Density Probe Table */}
      {viewMode === "table" ? (
        <div className="rounded-lg bg-paper-2 border border-rule overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-rule bg-paper/50 text-[11px] font-mono text-ink-muted uppercase select-none">
                  <th className="py-3 px-4 font-medium">服务器节点</th>
                  <th className="py-3 px-3 font-medium">操作系统 / 架构</th>
                  <th className="py-3 px-3 font-medium">开机时长</th>
                  <th className="py-3 px-3 font-medium min-w-[140px]">CPU 负载</th>
                  <th className="py-3 px-3 font-medium min-w-[130px]">物理内存</th>
                  <th className="py-3 px-3 font-medium min-w-[120px]">硬盘存储</th>
                  <th className="py-3 px-3 font-medium min-w-[130px]">实时网络吞吐</th>
                  <th className="py-3 px-3 font-medium min-w-[130px]">月度流量配额</th>
                  <th className="py-3 px-3 font-medium text-center">延迟</th>
                  <th className="py-3 px-4 font-medium text-right">探针状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule font-mono">
                {filteredNodes.map((node) => {
                  const up = formatSpeed(node.uplinkSpeedBytes);
                  const down = formatSpeed(node.downlinkSpeedBytes);
                  const memTotal = node.memTotalBytes || 2147483648;
                  const memUsed = node.memUsedBytes || Math.floor(memTotal * (node.memUsage / 100));
                  const diskTotal = node.diskTotalBytes || 42949672960;
                  const diskUsed = node.diskUsedBytes || Math.floor(diskTotal * (node.diskUsage / 100));
                  const trafficUsedGB = (node.trafficUsedBytes / (1024 * 1024 * 1024)).toFixed(1);
                  const trafficLimitGB = (node.trafficLimitBytes / (1024 * 1024 * 1024)).toFixed(0);
                  const trafficPct = Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100);

                  return (
                    <tr
                      key={node.id}
                      className="probe-item-anim hover:bg-paper-hover transition-colors group"
                    >
                      {/* Node Name & IP */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink text-xs tracking-tight group-hover:text-accent transition-colors">
                            {node.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule font-mono shrink-0">
                            {node.countryName.split(" ")[0]}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-ink-muted mt-0.5 flex items-center gap-1.5">
                          <span>{node.ip}:{node.port}</span>
                          <span>•</span>
                          <span
                            className={`uppercase text-[10px] font-medium ${
                              node.type === "unlock" ? "text-purple-400" : "text-accent"
                            }`}
                          >
                            {node.type === "unlock" ? "SS 解锁" : "Reality 直连"}
                          </span>
                        </div>
                      </td>

                      {/* OS & Arch */}
                      <td className="py-3.5 px-3">
                        <div className="text-ink font-medium text-xs">
                          {node.os || "Debian 12.5 (bookworm)"}
                        </div>
                        <div className="text-[11px] text-ink-muted mt-0.5 flex items-center gap-1">
                          <span className="px-1 py-0.2 rounded bg-paper-3 text-ink-secondary border border-rule text-[10px]">
                            {node.arch || "x86_64"}
                          </span>
                          <span>{node.tcpCount || 120} TCP</span>
                        </div>
                      </td>

                      {/* Uptime */}
                      <td className="py-3.5 px-3 text-xs text-ink-secondary whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-ink-muted" />
                          <span>{node.uptime || "28天 14小时"}</span>
                        </div>
                      </td>

                      {/* CPU Usage & Load */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-ink font-semibold">{node.cpuUsage}%</span>
                          <span className="text-[10px] text-ink-muted">
                            Load {node.loadAvg ? node.loadAvg[0] : 0.15}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              node.cpuUsage > 80
                                ? "bg-status-danger"
                                : node.cpuUsage > 50
                                ? "bg-amber-400"
                                : "bg-accent"
                            }`}
                            style={{ width: `${node.cpuUsage}%` }}
                          />
                        </div>
                      </td>

                      {/* RAM Usage */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-ink font-semibold">{node.memUsage}%</span>
                          <span className="text-[10px] text-ink-muted">
                            {formatBytes(memUsed)} / {formatBytes(memTotal)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              node.memUsage > 85 ? "bg-status-danger" : "bg-sky-500"
                            }`}
                            style={{ width: `${node.memUsage}%` }}
                          />
                        </div>
                      </td>

                      {/* Disk Storage */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-ink font-semibold">{node.diskUsage}%</span>
                          <span className="text-[10px] text-ink-muted">
                            {formatBytes(diskUsed)} / {formatBytes(diskTotal)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500 transition-all duration-300"
                            style={{ width: `${node.diskUsage}%` }}
                          />
                        </div>
                      </td>

                      {/* Network Speeds */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                          <ArrowDown className="w-3 h-3" />
                          <RollingCounter value={down.val} decimals={1} suffix={` ${down.unit}`} />
                        </div>
                        <div className="flex items-center gap-1 text-sky-400 font-semibold text-xs mt-0.5">
                          <ArrowUp className="w-3 h-3" />
                          <RollingCounter value={up.val} decimals={1} suffix={` ${up.unit}`} />
                        </div>
                      </td>

                      {/* Monthly Traffic & Reset Day */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-ink-secondary text-[11px]">
                            {trafficUsedGB} / {trafficLimitGB} GB
                          </span>
                          <span className="text-[10px] text-ink-muted">
                            {trafficPct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              trafficPct > 90 ? "bg-status-danger" : "bg-accent"
                            }`}
                            style={{ width: `${trafficPct}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-ink-muted mt-0.5">
                          每月{node.trafficResetDay || 1}日重置
                        </div>
                      </td>

                      {/* Latency */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper-3 border border-rule text-xs font-semibold text-accent">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{node.latencyMs} ms</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Badge
                            variant={
                              node.status === "online"
                                ? "online"
                                : node.status === "circuit_broken"
                                ? "danger"
                                : "neutral"
                            }
                            pulse={node.status === "online"}
                            size="sm"
                          >
                            {node.status === "online"
                              ? "在线"
                              : node.status === "circuit_broken"
                              ? "熔断"
                              : "离线"}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* View Mode 2: Hardware Monitor Grid Matrix */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNodes.map((node) => {
            const up = formatSpeed(node.uplinkSpeedBytes);
            const down = formatSpeed(node.downlinkSpeedBytes);
            const memTotal = node.memTotalBytes || 2147483648;
            const memUsed = node.memUsedBytes || Math.floor(memTotal * (node.memUsage / 100));
            const diskTotal = node.diskTotalBytes || 42949672960;
            const diskUsed = node.diskUsedBytes || Math.floor(diskTotal * (node.diskUsage / 100));
            const trafficUsedGB = (node.trafficUsedBytes / (1024 * 1024 * 1024)).toFixed(1);
            const trafficLimitGB = (node.trafficLimitBytes / (1024 * 1024 * 1024)).toFixed(0);
            const trafficPct = Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100);

            return (
              <div
                key={node.id}
                className="probe-item-anim rounded-lg bg-paper-2 border border-rule hover:border-rule-active p-5 space-y-4 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-ink text-sm tracking-tight">
                        {node.name}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule font-mono">
                        {node.countryName}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-ink-muted mt-1 flex items-center gap-2">
                      <span>{node.ip}:{node.port}</span>
                      <span>•</span>
                      <span>{node.os || "Debian 12"}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">
                        {node.bandwidthMbps ? `${node.bandwidthMbps >= 1000 ? node.bandwidthMbps / 1000 + " Gbps" : node.bandwidthMbps + " Mbps"}` : "1 Gbps"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant={
                        node.status === "online"
                          ? "online"
                          : node.status === "circuit_broken"
                          ? "danger"
                          : "neutral"
                      }
                      pulse={node.status === "online"}
                      size="sm"
                    >
                      {node.status === "online" ? "在线" : "离线"}
                    </Badge>
                  </div>
                </div>

                {/* 3 Metric Gauges (CPU, Memory, Disk) */}
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-paper/60 border border-rule-subtle font-mono text-xs">
                  <div>
                    <div className="flex items-center justify-between text-ink-muted mb-1 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-accent" /> CPU
                      </span>
                      <span className="font-semibold text-ink">{node.cpuUsage}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${node.cpuUsage}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-ink-muted mt-1">
                      Load {node.loadAvg ? node.loadAvg[0] : 0.15}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-ink-muted mb-1 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3 text-sky-400" /> 内存
                      </span>
                      <span className="font-semibold text-ink">{node.memUsage}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${node.memUsage}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-ink-muted mt-1">
                      {formatBytes(memUsed)} / {formatBytes(memTotal)}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-ink-muted mb-1 text-[11px]">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-purple-400" /> 硬盘
                      </span>
                      <span className="font-semibold text-ink">{node.diskUsage}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: `${node.diskUsage}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-ink-muted mt-1">
                      {formatBytes(diskUsed)} / {formatBytes(diskTotal)}
                    </div>
                  </div>
                </div>

                {/* Network & Uptime Footer */}
                <div className="pt-3 border-t border-rule flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ArrowDown className="w-3 h-3" />
                      <RollingCounter value={down.val} decimals={1} suffix={` ${down.unit}`} />
                    </span>
                    <span className="text-sky-400 flex items-center gap-1">
                      <ArrowUp className="w-3 h-3" />
                      <RollingCounter value={up.val} decimals={1} suffix={` ${up.unit}`} />
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-ink-muted text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {node.uptime || "28天"}
                    </span>
                    <span className="text-accent font-semibold">
                      {node.latencyMs} ms
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
