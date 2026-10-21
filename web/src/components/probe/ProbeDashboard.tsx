import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { NodeItem } from "../../types";
import { Badge } from "../common/Badge";
import { RollingCounter } from "../common/RollingCounter";
import { Input } from "../common/Input";
import { Tooltip } from "../common/Tooltip";
import {
  Cpu,
  HardDrive,
  ArrowUp,
  ArrowDown,
  Clock,
  ListBullets,
  SquaresFour,
  MagnifyingGlass,
  Database,
  Lightning,
  ShieldCheck,
} from "@phosphor-icons/react";
import { formatSpeed, formatBytes, toGB, formatPct } from "../../utils/format";

gsap.registerPlugin(useGSAP);

interface ProbeDashboardProps {
  nodes: NodeItem[];
  onSelectNode?: (node: NodeItem) => void;
}

export const ProbeDashboard: React.FC<ProbeDashboardProps> = ({ nodes, onSelectNode }) => {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanOsName = (os?: string) => {
    if (!os) return "未知系统";
    return os
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/(\d+\.\d+)\.\d+/g, "$1")
      .replace(/LTS/gi, "")
      .trim();
  };

  const formatCompactBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return "0";
    if (bytes >= 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)}T`;
    if (bytes >= 1024 * 1024 * 1024) {
      const gb = bytes / (1024 * 1024 * 1024);
      return gb % 1 === 0 ? `${gb.toFixed(0)}G` : `${gb.toFixed(1)}G`;
    }
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}M`;
    return `${(bytes / 1024).toFixed(0)}K`;
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
      { opacity: 1, y: 0, stagger: 0.035, duration: 0.45, ease: "expo.out", clearProps: "transform,translate,scale" }
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: 在管探针总数 */}
        <div className="group card-lift p-3 sm:p-3.5 rounded-xl bg-paper-2 border border-rule flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-mono text-ink-muted truncate">在管探针总数</div>
            <div className="text-base sm:text-lg font-bold font-mono text-ink mt-0.5 flex items-baseline gap-1 truncate">
              <span>{onlineCount}</span>
              <span className="text-xs text-ink-muted font-normal">/ {nodes.length} 在线</span>
            </div>
          </div>
          <div className="icon-tile w-8 h-8 sm:w-9 sm:h-9 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 ml-1.5">
            <ShieldCheck weight="duotone" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
        </div>

        {/* Card 2: 全网出入吞吐 */}
        <div className="group card-lift p-3 sm:p-3.5 rounded-xl bg-paper-2 border border-rule flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-mono text-ink-muted truncate">全网出入吞吐</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-ink mt-1 flex flex-col xs:flex-row items-start xs:items-center gap-0.5 sm:gap-2 truncate">
              <span className="text-emerald-400 flex items-center gap-0.5 truncate">
                <ArrowDown className="w-3 h-3 shrink-0" />
                <RollingCounter value={aggDown.val} decimals={1} suffix={` ${aggDown.unit}`} />
              </span>
              <span className="text-sky-400 flex items-center gap-0.5 truncate">
                <ArrowUp className="w-3 h-3 shrink-0" />
                <RollingCounter value={aggUp.val} decimals={1} suffix={` ${aggUp.unit}`} />
              </span>
            </div>
          </div>
          <div className="icon-tile w-8 h-8 sm:w-9 sm:h-9 bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0 ml-1.5">
            <Lightning weight="duotone" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
        </div>

        {/* Card 3: 全网平均 CPU 负载 */}
        <div className="group card-lift p-3 sm:p-3.5 rounded-xl bg-paper-2 border border-rule flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-mono text-ink-muted truncate">平均 CPU 负载</div>
            <div className="text-base sm:text-lg font-bold font-mono text-ink mt-0.5">
              {avgCpu}%
            </div>
          </div>
          <div className="icon-tile w-8 h-8 sm:w-9 sm:h-9 bg-accent/10 text-accent border border-accent/20 shrink-0 ml-1.5">
            <Cpu weight="duotone" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
        </div>

        {/* Card 4: 物理内存总占用 */}
        <div className="group card-lift p-3 sm:p-3.5 rounded-xl bg-paper-2 border border-rule flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-mono text-ink-muted truncate">物理内存总占用</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-ink mt-1 truncate">
              {formatBytes(totalMemUsed)} <span className="text-[10px] font-normal text-ink-muted">/ {formatBytes(totalMemTotal)}</span>
            </div>
          </div>
          <div className="icon-tile w-8 h-8 sm:w-9 sm:h-9 bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0 ml-1.5">
            <Database weight="duotone" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
        </div>
      </div>

      {/* Toolbar: Filter, Search & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-paper-2 p-2.5 sm:p-3 rounded-lg border border-rule">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-0.5 sm:pb-0">
          {/* Region Tabs */}
          <div className="flex items-center gap-1 bg-paper p-1 rounded-md border border-rule shrink-0">
            {[
              { id: "all", label: "全部探针" },
              { id: "asia", label: "亚太地区" },
              { id: "west", label: "欧美地区" },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRegionFilter(r.id)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer shrink-0 ${
                  regionFilter === r.id
                    ? "bg-paper-2 text-ink shadow-sm border border-rule"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-ink-muted font-mono pl-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>实时探针心跳 (3s 采样)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <div className="flex-1 sm:w-56">
            <Input
              prefixIcon={<MagnifyingGlass className="w-3.5 h-3.5" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索主机、IP 或系统..."
            />
          </div>

          {/* View Mode Toggle Buttons (Desktop only, mobile has dedicated card stream) */}
          <div className="hidden md:flex items-center gap-0.5 bg-paper p-0.5 rounded-md border border-rule shrink-0">
            <Tooltip content="表格列表模式 (ServerStatus 风格)">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === "table"
                    ? "bg-paper-2 text-accent border border-rule shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <ListBullets className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="矩阵卡片模式">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-paper-2 text-accent border border-rule shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <SquaresFour className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Mobile View: High-Performance Touch-Friendly Card Stream */}
      <div className="md:hidden space-y-3">
        {filteredNodes.map((node) => {
          const up = formatSpeed(node.uplinkSpeedBytes);
          const down = formatSpeed(node.downlinkSpeedBytes);
          const memTotal = node.memTotalBytes || 2147483648;
          const memUsed = node.memUsedBytes || Math.floor(memTotal * (node.memUsage / 100));
          const trafficUsedGB = toGB(node.trafficUsedBytes);
          const trafficLimitGB = toGB(node.trafficLimitBytes, 0);
          const trafficPct = Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100);

          return (
            <div
              key={node.id}
              onClick={() => onSelectNode?.(node)}
              className="probe-item-anim card-lift rounded-xl bg-paper-2 border border-rule p-3.5 space-y-3 active:bg-paper-hover cursor-pointer select-none"
              title="点击查看详细延迟时序与硬件指标"
            >
              {/* Header: Node Name + Country + Status Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink text-sm tracking-tight truncate">
                      {node.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule font-mono shrink-0">
                      {node.countryName.split(" ")[0]}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted mt-0.5 flex items-center gap-1.5 truncate">
                    <span>{node.ip}:{node.port}</span>
                    <span>•</span>
                    <span
                      className={`uppercase text-[10px] font-medium shrink-0 ${
                        node.type === "unlock" ? "text-purple-400" : "text-accent"
                      }`}
                    >
                      {node.type === "unlock" ? "SS 解锁" : "Reality 直连"}
                    </span>
                    <span>•</span>
                    <span className="truncate">{cleanOsName(node.os)}</span>
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
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
              </div>

              {/* Metrics Grid: CPU & RAM */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-rule-subtle">
                {/* CPU */}
                <div className="bg-paper/60 p-2 rounded-lg border border-rule">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-ink-muted flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-accent" />
                      <span>CPU 负载</span>
                    </span>
                    <span className="font-mono font-semibold text-ink">{formatPct(node.cpuUsage)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        node.cpuUsage > 80
                          ? "bg-status-danger"
                          : node.cpuUsage > 50
                          ? "bg-amber-400"
                          : "bg-accent"
                      }`}
                      style={{ width: `${node.cpuUsage}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-ink-muted mt-1">
                    <span>Load {node.loadAvg ? formatPct(node.loadAvg[0]) : 0.15}</span>
                    <span>{node.uptime || "28天"}</span>
                  </div>
                </div>

                {/* RAM */}
                <div className="bg-paper/60 p-2 rounded-lg border border-rule">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-ink-muted flex items-center gap-1">
                      <Database className="w-3 h-3 text-sky-400" />
                      <span>内存占用</span>
                    </span>
                    <span className="font-mono font-semibold text-ink">{formatPct(node.memUsage)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        node.memUsage > 85 ? "bg-status-danger" : "bg-sky-500"
                      }`}
                      style={{ width: `${node.memUsage}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-ink-muted mt-1 truncate">
                    {formatCompactBytes(memUsed)} / {formatCompactBytes(memTotal)}
                  </div>
                </div>
              </div>

              {/* Bottom Bar: Speeds & Monthly Traffic */}
              <div className="bg-paper/60 p-2.5 rounded-lg border border-rule space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                      <ArrowDown className="w-3 h-3" />
                      <span>{down.val.toFixed(1)} {down.unit}</span>
                    </span>
                    <span className="text-sky-400 font-semibold flex items-center gap-0.5">
                      <ArrowUp className="w-3 h-3" />
                      <span>{up.val.toFixed(1)} {up.unit}</span>
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted">
                    <span className="text-ink font-semibold">{trafficUsedGB}</span> / {trafficLimitGB} GB
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      trafficPct > 90 ? "bg-status-danger" : "bg-accent"
                    }`}
                    style={{ width: `${trafficPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {filteredNodes.length === 0 && (
          <div className="p-8 text-center rounded-lg border border-dashed border-rule text-ink-muted text-sm">
            暂无符合条件的探针节点
          </div>
        )}
      </div>

      {/* Desktop View: ServerStatus Table or Matrix Grid */}
      <div className="hidden md:block">
        {viewMode === "table" ? (
          <div className="rounded-lg bg-paper-2 border border-rule overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-rule bg-paper/50 text-[11px] font-mono text-ink-muted uppercase select-none whitespace-nowrap">
                  <th className="py-3 px-4 font-medium min-w-[190px] whitespace-nowrap">服务器节点</th>
                  <th className="py-3 px-3 font-medium min-w-[120px] whitespace-nowrap">系统 / 架构</th>
                  <th className="py-3 px-3 font-medium min-w-[100px] whitespace-nowrap">开机时长</th>
                  <th className="py-3 px-3 font-medium min-w-[110px] whitespace-nowrap">CPU 负载</th>
                  <th className="py-3 px-3 font-medium min-w-[125px] whitespace-nowrap">物理内存</th>
                  <th className="py-3 px-3 font-medium min-w-[115px] whitespace-nowrap">硬盘存储</th>
                  <th className="py-3 px-3 font-medium min-w-[110px] whitespace-nowrap">实时网速</th>
                  <th className="py-3 px-3 font-medium min-w-[130px] whitespace-nowrap">月度流量</th>
                  <th className="py-3 px-4 font-medium min-w-[80px] text-right whitespace-nowrap">状态</th>
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
                  const trafficUsedGB = toGB(node.trafficUsedBytes);
                  const trafficLimitGB = toGB(node.trafficLimitBytes, 0);
                  const trafficPct = Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100);

                  return (
                    <tr
                      key={node.id}
                      onClick={() => onSelectNode?.(node)}
                      className="probe-item-anim hover:bg-paper-hover transition-colors group cursor-pointer"
                      title="点击查看此节点的详细延迟监测与硬件时序图表"
                    >
                      {/* Node Name & IP */}
                      <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-semibold text-ink text-xs tracking-tight group-hover:text-accent group-hover:underline transition-colors max-w-[150px] truncate inline-block"
                            title={node.name}
                          >
                            {node.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule font-mono shrink-0 whitespace-nowrap">
                            {node.countryName.split(" ")[0]}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-ink-muted mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                          <span>{node.ip}:{node.port}</span>
                          <span>•</span>
                          <span
                            className={`uppercase text-[10px] font-medium shrink-0 whitespace-nowrap ${
                              node.type === "unlock" ? "text-purple-400" : "text-accent"
                            }`}
                          >
                            {node.type === "unlock" ? "SS 解锁" : "Reality 直连"}
                          </span>
                        </div>
                      </td>

                      {/* OS & Arch */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="text-ink font-medium text-xs whitespace-nowrap truncate max-w-[120px]" title={node.os}>
                          {cleanOsName(node.os)}
                        </div>
                        <div className="text-[11px] text-ink-muted mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                          <span className="px-1 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule text-[10px] font-mono shrink-0">
                            {node.arch || "x86_64"}
                          </span>
                          <span className="shrink-0">{node.tcpCount || 120} TCP</span>
                          {node.tcpCongestion && (
                            <span
                              className={`px-1 py-0.2 rounded text-[10px] font-mono border shrink-0 ${
                                node.tcpCongestion.toLowerCase() === "bbr"
                                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                                  : "text-ink-muted bg-paper-3 border-rule"
                              }`}
                              title={`TCP 算法: ${node.tcpCongestion}`}
                            >
                              {node.tcpCongestion.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Uptime */}
                      <td className="py-3.5 px-3 text-xs text-ink-secondary whitespace-nowrap">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                          <span>{node.uptime || "28天 14小时"}</span>
                        </div>
                      </td>

                      {/* CPU Usage & Load */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center justify-between text-xs mb-1 gap-2 whitespace-nowrap">
                          <span className="text-ink font-semibold">{formatPct(node.cpuUsage)}%</span>
                          <span className="text-[10px] text-ink-muted shrink-0 font-mono">
                            Load {node.loadAvg ? formatPct(node.loadAvg[0]) : 0.15}
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
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center justify-between text-xs mb-1 gap-2 whitespace-nowrap">
                          <span className="text-ink font-semibold">{formatPct(node.memUsage)}%</span>
                          <span className="text-[10px] text-ink-muted shrink-0 whitespace-nowrap font-mono">
                            {formatCompactBytes(memUsed)} / {formatCompactBytes(memTotal)}
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
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center justify-between text-xs mb-1 gap-2 whitespace-nowrap">
                          <span className="text-ink font-semibold">{formatPct(node.diskUsage)}%</span>
                          <span className="text-[10px] text-ink-muted shrink-0 whitespace-nowrap font-mono">
                            {formatCompactBytes(diskUsed)} / {formatCompactBytes(diskTotal)}
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
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-emerald-400 font-semibold text-xs whitespace-nowrap">
                          <ArrowDown className="w-3 h-3 shrink-0" />
                          <RollingCounter value={down.val} decimals={1} suffix={` ${down.unit}`} />
                        </div>
                        <div className="flex items-center gap-1 text-sky-400 font-semibold text-xs mt-0.5 whitespace-nowrap">
                          <ArrowUp className="w-3 h-3 shrink-0" />
                          <RollingCounter value={up.val} decimals={1} suffix={` ${up.unit}`} />
                        </div>
                      </td>

                      {/* Monthly Traffic & Reset Day */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center justify-between text-xs mb-1 gap-2 whitespace-nowrap">
                          <span className="text-ink-secondary text-[11px] whitespace-nowrap font-mono">
                            {trafficUsedGB} <span className="text-[10px] text-ink-muted">/ {trafficLimitGB}G</span>
                          </span>
                          <span className="text-[10px] text-ink-muted shrink-0 font-mono">
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
                        <div className="text-[10px] text-ink-muted mt-0.5 whitespace-nowrap">
                          每月{node.trafficResetDay || 1}日重置
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end shrink-0 whitespace-nowrap min-w-[64px]">
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

            return (
              <div
                key={node.id}
                className="probe-item-anim card-lift rounded-xl bg-paper-2 border border-rule p-5 space-y-4"
              >
                {/* Header */}
                <div
                  onClick={() => onSelectNode?.(node)}
                  className="flex items-start justify-between gap-3 cursor-pointer group/header"
                  title="点击查看此节点的详细延迟监测与硬件时序图表"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-ink text-sm tracking-tight group-hover/header:text-accent group-hover/header:underline transition-colors">
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
                      {node.tcpCongestion && (
                        <>
                          <span>•</span>
                          <span className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                            node.tcpCongestion.toLowerCase() === "bbr"
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                              : "text-ink-muted bg-paper-3 border-rule"
                          }`}>
                            {node.tcpCongestion.toUpperCase()}
                          </span>
                        </>
                      )}
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
                      <span className="font-semibold text-ink">{formatPct(node.cpuUsage)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${node.cpuUsage}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-ink-muted mt-1">
                      Load {node.loadAvg ? formatPct(node.loadAvg[0]) : 0.15}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-ink-muted mb-1 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3 text-sky-400" /> 内存
                      </span>
                      <span className="font-semibold text-ink">{formatPct(node.memUsage)}%</span>
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
                      <span className="font-semibold text-ink">{formatPct(node.diskUsage)}%</span>
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

                  <div className="flex items-center gap-2.5 text-ink-muted text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {node.uptime || "28天"}
                    </span>
                    <button
                      onClick={() => onSelectNode?.(node)}
                      className="px-2 py-0.5 rounded bg-accent/10 hover:bg-accent/20 text-accent font-medium text-[11px] border border-accent/25 transition-colors cursor-pointer"
                    >
                      详细监测 →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
