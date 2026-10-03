import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Lightning,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeSlash,
  Info,
  CalendarBlank,
} from "@phosphor-icons/react";
import { NodeItem, NodeLatencyHistory } from "../../types";
import { Badge } from "../common/Badge";

interface NodeDetailModalProps {
  node: NodeItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const getExpiryInfo = (expiresAt?: string) => {
  if (!expiresAt) return null;
  const target = new Date(expiresAt + "T23:59:59");
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return {
    diffDays,
    isExpired: diffDays <= 0,
    isExpiringSoon: diffDays > 0 && diffDays <= 7,
  };
};

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  node,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"latency" | "load">("latency");
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "12h" | "1d" | "3d" | "7d">("1h");
  const [isSmooth, setIsSmooth] = useState(true);
  const [hiddenTargets, setHiddenTargets] = useState<string[]>([]);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [latencyHoverIdx, setLatencyHoverIdx] = useState<number | null>(null);
  const [loadHoverIdx, setLoadHoverIdx] = useState<number | null>(null);
  const [netHoverIdx, setNetHoverIdx] = useState<number | null>(null);

  // Latency & Load Data State
  const [latencyData, setLatencyData] = useState<NodeLatencyHistory[]>([]);
  const [loadData, setLoadData] = useState<{
    timestamps: number[];
    cpu: number[];
    mem: number[];
    disk: number[];
    netIn: number[];
    netOut: number[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const latencySvgRef = useRef<SVGSVGElement>(null);
  const loadSvgRef = useRef<SVGSVGElement>(null);
  const netSvgRef = useRef<SVGSVGElement>(null);

  // Fetch latency history or load history
  useEffect(() => {
    if (!node || !isOpen) return;
    setLoading(true);

    if (activeTab === "latency") {
      fetch(`/api/ping/node-history/${node.id}?range=${timeRange}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            setLatencyData(res.data);
          }
        })
        .catch((err) => console.error("Fetch latency history failed:", err))
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/nodes/${node.id}/history?range=${timeRange}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            setLoadData(res.data);
          }
        })
        .catch((err) => console.error("Fetch load history failed:", err))
        .finally(() => setLoading(false));
    }
  }, [node?.id, isOpen, activeTab, timeRange]);

  if (!isOpen || !node) return null;

  // Toggle individual target line visibility
  const toggleTarget = (taskName: string) => {
    setHiddenTargets((prev) =>
      prev.includes(taskName)
        ? prev.filter((t) => t !== taskName)
        : [...prev, taskName]
    );
  };

  // Toggle all targets
  const toggleAllTargets = () => {
    if (hiddenTargets.length === latencyData.length) {
      setHiddenTargets([]);
    } else {
      setHiddenTargets(latencyData.map((d) => d.taskName));
    }
  };

  const visibleSeries = latencyData.filter(
    (s) => !hiddenTargets.includes(s.taskName)
  );

  // Common dimensions
  const chartWidth = 920;

  // Generate SVG path string (Catmull-Rom / cubic Bézier vs straight line)
  const generatePath = (pts: { x: number; y: number }[], smooth: boolean) => {
    if (!pts || pts.length === 0) return "";
    if (!smooth || pts.length < 3) {
      return pts.reduce(
        (acc, pt, i) =>
          `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
        ""
      );
    }

    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Generate closed area path for SVG gradient fills (fading down to baseline)
  const generateAreaPath = (
    pts: { x: number; y: number }[],
    baselineY: number,
    smooth: boolean
  ) => {
    if (!pts || pts.length === 0) return "";
    const linePath = generatePath(pts, smooth);
    const firstPt = pts[0];
    const lastPt = pts[pts.length - 1];
    return `${linePath} L ${lastPt.x.toFixed(1)} ${baselineY.toFixed(1)} L ${firstPt.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  };

  // X-axis timestamps format
  const formatTimeTick = (timestamp?: number) => {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    if (timeRange === "3d" || timeRange === "7d") {
      return `${mm}/${dd} ${hh}:${min}`;
    }
    return `${hh}:${min}`;
  };

  const timeRangeLabels: Record<string, string> = {
    "1h": "1 小时",
    "6h": "6 小时",
    "12h": "12 小时",
    "1d": "1 天",
    "3d": "3 天",
    "7d": "7 天",
  };

  // ==========================================
  // LATENCY CHART CALCULATIONS
  // ==========================================
  const latencyPadding = { top: 25, right: 30, bottom: 35, left: 55 };
  const latencyChartHeight = 300;
  const latencyInnerWidth = chartWidth - latencyPadding.left - latencyPadding.right;
  const latencyInnerHeight = latencyChartHeight - latencyPadding.top - latencyPadding.bottom;
  const latencyBaseY = latencyChartHeight - latencyPadding.bottom;

  let maxLatency = 50;
  visibleSeries.forEach((s) => {
    s.history.forEach((pt) => {
      if (pt.latencyMs > maxLatency) maxLatency = pt.latencyMs;
    });
  });
  maxLatency = Math.ceil((maxLatency * 1.15) / 10) * 10;
  const minLatency = 0;

  const latencyPointsCount =
    visibleSeries[0]?.history.length ||
    (timeRange === "1h"
      ? 60
      : timeRange === "7d"
      ? 112
      : timeRange === "3d"
      ? 108
      : timeRange === "1d"
      ? 96
      : 72);

  const getLatencyX = (index: number) => {
    return latencyPadding.left + (index / (latencyPointsCount - 1 || 1)) * latencyInnerWidth;
  };

  const getLatencyY = (val: number) => {
    const clamped = Math.max(minLatency, Math.min(maxLatency, val));
    return (
      latencyPadding.top +
      latencyInnerHeight -
      ((clamped - minLatency) / (maxLatency - minLatency || 1)) * latencyInnerHeight
    );
  };

  const latencyYTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const val = Math.round(minLatency + ratio * (maxLatency - minLatency));
    return { val, y: getLatencyY(val) };
  });

  const latencyTimestamps = visibleSeries[0]?.history.map((h) => h.timestamp) || [];
  const latencyXTickIndices = [
    0,
    Math.floor(latencyPointsCount * 0.25),
    Math.floor(latencyPointsCount * 0.5),
    Math.floor(latencyPointsCount * 0.75),
    latencyPointsCount - 1,
  ];

  const handleLatencyMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!latencySvgRef.current || latencyPointsCount <= 0) return;
    const rect = latencySvgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    const relX = svgX - latencyPadding.left;
    const frac = Math.max(0, Math.min(1, relX / latencyInnerWidth));
    const idx = Math.round(frac * (latencyPointsCount - 1));
    setLatencyHoverIdx(idx);
  };

  // ==========================================
  // HARDWARE LOAD CHART CALCULATIONS
  // ==========================================
  const loadPadding = { top: 25, right: 30, bottom: 32, left: 55 };
  const loadChartHeight = 220;
  const loadInnerWidth = chartWidth - loadPadding.left - loadPadding.right;
  const loadInnerHeight = loadChartHeight - loadPadding.top - loadPadding.bottom;
  const loadBaseY = loadChartHeight - loadPadding.bottom;

  const loadPointsCount = loadData?.cpu.length || 60;

  const getLoadX = (index: number) => {
    return loadPadding.left + (index / (loadPointsCount - 1 || 1)) * loadInnerWidth;
  };

  const getLoadY = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    return loadPadding.top + loadInnerHeight - (clamped / 100) * loadInnerHeight;
  };

  const loadYTicks = [0, 25, 50, 75, 100].map((pct) => ({
    val: pct,
    y: getLoadY(pct),
  }));

  const loadTimestamps = loadData?.timestamps || [];
  const loadXTickIndices = [
    0,
    Math.floor(loadPointsCount * 0.25),
    Math.floor(loadPointsCount * 0.5),
    Math.floor(loadPointsCount * 0.75),
    loadPointsCount - 1,
  ];

  const handleLoadMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!loadSvgRef.current || loadPointsCount <= 0) return;
    const rect = loadSvgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    const relX = svgX - loadPadding.left;
    const frac = Math.max(0, Math.min(1, relX / loadInnerWidth));
    const idx = Math.round(frac * (loadPointsCount - 1));
    setLoadHoverIdx(idx);
  };

  // Find Peak CPU Point in Load Data
  let peakCpuIdx = 0;
  let peakCpuVal = 0;
  if (loadData?.cpu && loadData.cpu.length > 0) {
    loadData.cpu.forEach((v, i) => {
      if (v > peakCpuVal) {
        peakCpuVal = v;
        peakCpuIdx = i;
      }
    });
  }

  // Network I/O Sub-track calculations
  const netChartHeight = 112;
  const netPadding = { top: 16, right: 30, bottom: 22, left: 55 };
  const netInnerWidth = chartWidth - netPadding.left - netPadding.right;
  const netInnerHeight = netChartHeight - netPadding.top - netPadding.bottom;
  const netBaseY = netChartHeight - netPadding.bottom;

  const handleNetMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!netSvgRef.current || loadPointsCount <= 0) return;
    const rect = netSvgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    const relX = svgX - netPadding.left;
    const frac = Math.max(0, Math.min(1, relX / netInnerWidth));
    const idx = Math.round(frac * (loadPointsCount - 1));
    setNetHoverIdx(idx);
  };

  let maxNetBytes = 102400; // 100 KB/s min floor
  if (loadData) {
    [...loadData.netIn, ...loadData.netOut].forEach((b) => {
      if (b > maxNetBytes) maxNetBytes = b;
    });
  }
  maxNetBytes = Math.ceil((maxNetBytes * 1.2) / 10240) * 10240;

  const getNetY = (bytes: number) => {
    const clamped = Math.max(0, Math.min(maxNetBytes, bytes));
    return netPadding.top + netInnerHeight - (clamped / maxNetBytes) * netInnerHeight;
  };

  const formatNetSpeed = (bytes: number) => {
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(1)} MB/s`;
    }
    return `${(bytes / 1024).toFixed(0)} KB/s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-paper/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-paper-2 border border-rule rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule bg-paper/40">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {node.country === "HK" ? "🇭🇰" : node.country === "JP" ? "🇯🇵" : "🇺🇸"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink tracking-tight font-sans">
                  {node.name}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule font-mono">
                  {node.ip}:{node.port}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-sans">
                  {node.os || "Debian 12"}
                </span>
              </div>
              <div className="text-[11px] font-mono text-ink-muted flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-ink-muted" />
                  <span>在线时长: {node.uptime || "28天 14小时"}</span>
                </span>
                <span>•</span>
                <span>架构: {node.arch || "x86_64"}</span>
                <span>•</span>
                <span>峰值带宽: {node.bandwidthMbps ? `${node.bandwidthMbps} Mbps` : "1 Gbps"}</span>
                {node.costAmount !== undefined && node.costAmount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-amber-400 font-medium">
                      费用: {node.costCurrency === "USD" ? "$" : node.costCurrency === "EUR" ? "€" : "¥"}{node.costAmount}{node.costPeriod === "annually" ? "/年" : node.costPeriod === "quarterly" ? "/季" : "/月"}
                    </span>
                  </>
                )}
                {node.expiresAt && (
                  <>
                    <span>•</span>
                    {(() => {
                      const exp = getExpiryInfo(node.expiresAt);
                      return (
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            exp?.isExpired
                              ? "text-status-danger"
                              : exp?.isExpiringSoon
                              ? "text-amber-400"
                              : "text-ink-secondary"
                          }`}
                        >
                          <CalendarBlank className="w-3.5 h-3.5" />
                          <span>到期: {node.expiresAt}</span>
                          <span className="text-[10px] opacity-80">
                            ({exp?.isExpired ? "已到期" : `剩 ${exp?.diffDays} 天`})
                          </span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded border font-mono ${
                              node.autoRenew
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-paper-3 text-ink-muted border-rule"
                            }`}
                          >
                            {node.autoRenew ? "自动续费" : "手动续费"}
                          </span>
                        </span>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={node.status === "online" ? "online" : "danger"}
              size="sm"
              pulse={node.status === "online"}
            >
              {node.status === "online" ? "在线" : "离线"}
            </Badge>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-hover transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Controls Toolbar */}
        <div className="px-6 py-3 border-b border-rule flex flex-col sm:flex-row items-center justify-between gap-3 bg-paper/30">
          {/* Segmented Mode Switch: 负载 | 延迟 */}
          <div className="flex items-center bg-paper p-0.5 rounded-lg border border-rule shadow-xs">
            <button
              onClick={() => setActiveTab("load")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === "load"
                  ? "bg-paper-2 text-accent font-bold shadow-xs border border-rule"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              综合负载
            </button>
            <button
              onClick={() => setActiveTab("latency")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === "latency"
                  ? "bg-paper-2 text-accent font-bold shadow-xs border border-rule"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              测速延迟
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-paper p-0.5 rounded-lg border border-rule">
            {(
              [
                { id: "1h", label: "1 小时" },
                { id: "6h", label: "6 小时" },
                { id: "12h", label: "12 小时" },
                { id: "1d", label: "1 天" },
                { id: "3d", label: "3 天" },
                { id: "7d", label: "7 天" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer font-mono ${
                  timeRange === t.id
                    ? "bg-paper-2 text-ink font-semibold shadow-xs border border-rule"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 space-y-6">
          {/* ═══════════════════════════════════════════════════════════
              TAB 1: LATENCY VIEW (Lieflat Hairline Line & Hairarea)
              ═══════════════════════════════════════════════════════════ */}
          {activeTab === "latency" && (
            <div className="space-y-4">
              {/* Target Legend Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {latencyData.map((task) => {
                  const isHidden = hiddenTargets.includes(task.taskName);
                  const isHovered = hoveredTarget === task.taskName;
                  return (
                    <div
                      key={task.taskId}
                      onClick={() => toggleTarget(task.taskName)}
                      onMouseEnter={() => setHoveredTarget(task.taskName)}
                      onMouseLeave={() => setHoveredTarget(null)}
                      className={`relative p-2.5 rounded-xl bg-paper border transition-all cursor-pointer select-none overflow-hidden ${
                        isHidden
                          ? "opacity-35 border-rule grayscale"
                          : isHovered
                          ? "border-accent/80 shadow-md ring-1 ring-accent/30 bg-paper-2"
                          : "border-rule hover:border-rule-active hover:bg-paper-hover shadow-xs"
                      }`}
                      title="点击隐藏/显示折线，悬停聚焦高亮"
                    >
                      {/* Left Colored Accent Bar */}
                      <span
                        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l transition-all"
                        style={{
                          backgroundColor: task.color,
                          opacity: isHidden ? 0.3 : 1,
                        }}
                      />

                      <div className="pl-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink truncate max-w-[90px] font-sans">
                            {task.taskName}
                          </span>
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: task.color }}
                          >
                            {task.currentLatency} ms
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-ink-muted mt-1.5 flex items-center justify-between">
                          <span>{task.lossRate > 0 ? `${task.lossRate.toFixed(1)}%丢包` : "0%丢包"}</span>
                          <span>±{task.jitter.toFixed(1)}ms抖动</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lieflat Card 4-Part Structure */}
              <div className="relative rounded-2xl bg-paper border border-rule p-5 overflow-hidden shadow-xs">
                {/* 1. 结论式标题 (h2) */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                  <h2 className="text-[15px] font-bold text-ink tracking-tight font-sans flex items-center gap-2">
                    <span>全网各测速目标链路时延走势</span>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border border-rule bg-paper-2 text-ink-muted">
                      {visibleSeries.length} / {latencyData.length} 系列激活
                    </span>
                  </h2>
                </div>

                {/* 2. 副标题 (sub: 说明 · 图例 · 时间范围) */}
                <div className="text-[11px] font-mono text-ink-muted mb-3 flex items-center gap-2 flex-wrap">
                  <span>ICMP 往返时延 (RTT)</span>
                  <span>·</span>
                  <span>纵轴 0–{maxLatency} ms 刻度</span>
                  <span>·</span>
                  <span>过去 {timeRangeLabels[timeRange]} 连续采样</span>
                  {hoveredTarget && (
                    <>
                      <span>·</span>
                      <span className="text-accent font-semibold font-sans">
                        正在聚焦: {hoveredTarget}
                      </span>
                    </>
                  )}
                </div>

                {/* Loading State Overlay */}
                {loading && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-paper/70 backdrop-blur-xs text-xs font-mono text-ink-muted">
                    <span>采样数据同步中...</span>
                  </div>
                )}

                {/* 3. 图表主体 (SVG) */}
                <div
                  className="w-full overflow-x-auto relative"
                  onMouseLeave={() => setLatencyHoverIdx(null)}
                >
                  <svg
                    ref={latencySvgRef}
                    viewBox={`0 0 ${chartWidth} ${latencyChartHeight}`}
                    className="w-full h-72 select-none cursor-crosshair block"
                    onMouseMove={handleLatencyMouseMove}
                  >
                    {/* SVG Linear Gradient Defs for Area Fills */}
                    <defs>
                      {latencyData.map((s) => (
                        <linearGradient
                          key={`grad-${s.taskId}`}
                          id={`area-grad-${s.taskId}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                          <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
                        </linearGradient>
                      ))}
                    </defs>

                    {/* Horizontal Y-Gridlines (Hairline dashed ticks) */}
                    {latencyYTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          x1={latencyPadding.left}
                          y1={tick.y}
                          x2={chartWidth - latencyPadding.right}
                          y2={tick.y}
                          stroke="currentColor"
                          className="text-rule/60"
                          strokeWidth="0.65"
                          strokeDasharray="2 4"
                        />
                        <text
                          x={latencyPadding.left - 8}
                          y={tick.y + 3.5}
                          textAnchor="end"
                          className="fill-ink-muted text-[10px] font-mono"
                        >
                          {tick.val} ms
                        </text>
                      </g>
                    ))}

                    {/* Baseline (Floor) Line */}
                    <line
                      x1={latencyPadding.left}
                      y1={latencyBaseY}
                      x2={chartWidth - latencyPadding.right}
                      y2={latencyBaseY}
                      stroke="currentColor"
                      className="text-rule"
                      strokeWidth="0.8"
                    />

                    {/* Small vertical ticks at the floor to anchor the timeline */}
                    {latencyXTickIndices.map((idx, i) => {
                      const xPos = getLatencyX(idx);
                      const t = latencyTimestamps[idx];
                      return (
                        <g key={i}>
                          <line
                            x1={xPos}
                            y1={latencyBaseY}
                            x2={xPos}
                            y2={latencyBaseY + 5}
                            stroke="currentColor"
                            className="text-rule"
                            strokeWidth="0.8"
                          />
                          <text
                            x={xPos}
                            y={latencyChartHeight - 8}
                            textAnchor={
                              i === 0
                                ? "start"
                                : i === latencyXTickIndices.length - 1
                                ? "end"
                                : "middle"
                            }
                            className="fill-ink-muted text-[10px] font-mono"
                          >
                            {formatTimeTick(t)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area fills under lines (Render active hovered line area first) */}
                    {visibleSeries.map((series) => {
                      const isHovered = hoveredTarget === series.taskName;
                      if (!isHovered) return null;
                      const pts = series.history.map((pt, i) => ({
                        x: getLatencyX(i),
                        y: getLatencyY(pt.latencyMs),
                      }));
                      const areaD = generateAreaPath(pts, latencyBaseY, isSmooth);
                      return (
                        <path
                          key={`area-${series.taskId}`}
                          d={areaD}
                          fill={`url(#area-grad-${series.taskId})`}
                          className="transition-opacity duration-300 pointer-events-none"
                        />
                      );
                    })}

                    {/* Target Data Series Lines */}
                    {visibleSeries.map((series) => {
                      const isHovered = hoveredTarget === series.taskName;
                      const hasHover = hoveredTarget !== null;
                      const pts = series.history.map((pt, i) => ({
                        x: getLatencyX(i),
                        y: getLatencyY(pt.latencyMs),
                      }));
                      const d = generatePath(pts, isSmooth);

                      const strokeW = isHovered ? 2.5 : hasHover ? 1.0 : 1.75;
                      const opacity = isHovered ? 1.0 : hasHover ? 0.22 : 0.88;

                      return (
                        <path
                          key={series.taskId}
                          d={d}
                          fill="none"
                          stroke={series.color}
                          strokeWidth={strokeW}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ opacity }}
                          className="transition-all duration-200 cursor-pointer"
                          onMouseEnter={() => setHoveredTarget(series.taskName)}
                        />
                      );
                    })}

                    {/* Interactive Crosshair Cursor */}
                    {latencyHoverIdx !== null && latencyHoverIdx >= 0 && (
                      <g className="pointer-events-none">
                        <line
                          x1={getLatencyX(latencyHoverIdx)}
                          y1={latencyPadding.top}
                          x2={getLatencyX(latencyHoverIdx)}
                          y2={latencyBaseY}
                          stroke="currentColor"
                          className="text-accent/80"
                          strokeWidth="1"
                          strokeDasharray="2 3"
                        />
                        {visibleSeries.map((series) => {
                          const pt = series.history[latencyHoverIdx];
                          if (!pt) return null;
                          const isHovered = hoveredTarget === series.taskName;
                          return (
                            <circle
                              key={series.taskId}
                              cx={getLatencyX(latencyHoverIdx)}
                              cy={getLatencyY(pt.latencyMs)}
                              r={isHovered ? 4.5 : 3.2}
                              fill={series.color}
                              stroke="var(--color-paper-2)"
                              strokeWidth="2"
                              className="transition-all duration-150"
                            />
                          );
                        })}
                      </g>
                    )}
                  </svg>

                  {/* Hover Floating Tooltip */}
                  {latencyHoverIdx !== null && latencyTimestamps[latencyHoverIdx] && (
                    <div
                      className={`absolute top-2 z-30 p-3 rounded-xl bg-paper-2/95 border border-rule shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-150 pointer-events-auto ${
                        latencyHoverIdx >= latencyPointsCount / 2
                          ? "left-16 right-auto"
                          : "right-4 left-auto"
                      }`}
                      style={{ minWidth: visibleSeries.length > 5 ? "320px" : "190px" }}
                    >
                      <div className="text-[11px] text-ink-muted border-b border-rule pb-1.5 mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-ink-muted" />
                          <span>采样时刻</span>
                        </span>
                        <span className="font-semibold text-ink">
                          {formatTimeTick(latencyTimestamps[latencyHoverIdx])}
                        </span>
                      </div>
                      <div
                        className={`pr-1 max-h-56 overflow-y-auto ${
                          visibleSeries.length > 5
                            ? "grid grid-cols-2 gap-x-3 gap-y-1.5"
                            : "space-y-1.5"
                        }`}
                      >
                        {visibleSeries.map((series) => {
                          const pt = series.history[latencyHoverIdx];
                          if (!pt) return null;
                          const isHovered = hoveredTarget === series.taskName;
                          return (
                            <div
                              key={series.taskId}
                              onMouseEnter={() => setHoveredTarget(series.taskName)}
                              onMouseLeave={() => setHoveredTarget(null)}
                              className={`flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                isHovered
                                  ? "bg-paper-3 font-bold ring-1 ring-accent/30"
                                  : "hover:bg-paper-3/50"
                              }`}
                            >
                              <span
                                className="flex items-center gap-1.5 truncate max-w-[95px]"
                                style={{ color: series.color }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: series.color }}
                                />
                                <span className="truncate">{series.taskName}</span>
                              </span>
                              <span className="font-bold text-ink ml-1.5">
                                {pt.latencyMs} ms
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. 底层控制栏与来源行 (src: 全大写 · 加字距) */}
                <div className="mt-4 pt-3 border-t border-rule flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  {/* Left Controls: 平滑开关 & 隐藏全部 */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSmooth}
                      onClick={() => setIsSmooth((prev) => !prev)}
                      className="flex items-center gap-2 cursor-pointer select-none group focus:outline-hidden"
                    >
                      <div
                        className={`relative inline-flex h-4 w-8 shrink-0 items-center p-0.5 rounded-full transition-colors duration-200 ease-in-out ${
                          isSmooth ? "bg-accent" : "bg-paper-3 border border-rule"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                            isSmooth ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </div>
                      <span className="text-xs text-ink-secondary group-hover:text-ink transition-colors font-sans font-medium">
                        贝塞尔平滑
                      </span>
                    </button>

                    <button
                      onClick={toggleAllTargets}
                      className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink px-2.5 py-1 rounded-md hover:bg-paper-2 border border-transparent hover:border-rule transition-colors cursor-pointer"
                    >
                      {hiddenTargets.length === latencyData.length ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>显示全部</span>
                        </>
                      ) : (
                        <>
                          <EyeSlash className="w-3.5 h-3.5" />
                          <span>隐藏全部</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right Source Line */}
                  <div className="text-[10px] font-mono text-ink-muted tracking-wider uppercase">
                    PROBE ENGINE · ICMP ECHO TELEMETRY · 10S SAMPLING
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              TAB 2: HARDWARE LOAD VIEW (Lieflat Hairline Area + Stream)
              ═══════════════════════════════════════════════════════════ */}
          {activeTab === "load" && (
            <div className="space-y-4">
              {/* Real-time Metric KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-paper border border-rule shadow-xs">
                  <div className="text-[11px] text-ink-muted flex items-center gap-1.5 font-mono">
                    <Cpu className="w-3.5 h-3.5 text-accent" />
                    <span>实时 CPU 占用</span>
                  </div>
                  <div className="text-xl font-bold text-ink font-mono mt-1">
                    {node.cpuUsage}%
                  </div>
                  <div className="text-[10px] font-mono text-ink-muted mt-0.5">
                    Load: {node.loadAvg ? node.loadAvg.join(", ") : "0.15, 0.22, 0.18"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-paper border border-rule shadow-xs">
                  <div className="text-[11px] text-ink-muted flex items-center gap-1.5 font-mono">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <span>物理内存负载</span>
                  </div>
                  <div className="text-xl font-bold text-ink font-mono mt-1">
                    {node.memUsage}%
                  </div>
                  <div className="text-[10px] font-mono text-ink-muted mt-0.5">
                    {node.memTotalBytes
                      ? `${(node.memTotalBytes / 1073741824).toFixed(1)} GB 总量`
                      : "2.0 GB"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-paper border border-rule shadow-xs">
                  <div className="text-[11px] text-ink-muted flex items-center gap-1.5 font-mono">
                    <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                    <span>硬盘存储占用</span>
                  </div>
                  <div className="text-xl font-bold text-ink font-mono mt-1">
                    {node.diskUsage}%
                  </div>
                  <div className="text-[10px] font-mono text-ink-muted mt-0.5">
                    {node.diskTotalBytes
                      ? `${(node.diskTotalBytes / 1073741824).toFixed(0)} GB 空间`
                      : "40 GB"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-paper border border-rule shadow-xs">
                  <div className="text-[11px] text-ink-muted flex items-center gap-1.5 font-mono">
                    <Lightning className="w-3.5 h-3.5 text-emerald-400" />
                    <span>实时网速吞吐</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                    <ArrowDown className="w-3 h-3" />
                    <span>{((node.downlinkSpeedBytes || 0) / 1024).toFixed(0)} KB/s</span>
                  </div>
                  <div className="text-[11px] font-bold text-sky-400 mt-0.5 flex items-center gap-1 font-mono">
                    <ArrowUp className="w-3 h-3" />
                    <span>{((node.uplinkSpeedBytes || 0) / 1024).toFixed(0)} KB/s</span>
                  </div>
                </div>
              </div>

              {/* Lieflat Card 4-Part Structure: Compute & Storage Area Chart */}
              <div className="relative rounded-2xl bg-paper border border-rule p-5 overflow-hidden shadow-xs">
                {/* 1. 结论式标题 (h2) */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                  <h2 className="text-[15px] font-bold text-ink tracking-tight font-sans flex items-center gap-2">
                    <span>综合算力与硬件资源时序消耗</span>
                    {peakCpuVal > 0 && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent">
                        CPU 峰值 {peakCpuVal}%
                      </span>
                    )}
                  </h2>
                </div>

                {/* 2. 副标题 (sub) */}
                <div className="text-[11px] font-mono text-ink-muted mb-3 flex items-center gap-2 flex-wrap">
                  <span>系统内核采样指标</span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-1.5 rounded-xs bg-sky-400 inline-block" />
                    <span>CPU 占用 (%)</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-1.5 rounded-xs bg-indigo-400 inline-block" />
                    <span>物理内存 (%)</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-purple-400 inline-block" />
                    <span>磁盘空间 (%)</span>
                  </span>
                  <span>·</span>
                  <span>过去 {timeRangeLabels[timeRange]} 走势</span>
                </div>

                {/* 3. 图表主体 (SVG) */}
                {loadData ? (
                  <div
                    className="w-full overflow-x-auto relative"
                    onMouseLeave={() => setLoadHoverIdx(null)}
                  >
                    <svg
                      ref={loadSvgRef}
                      viewBox={`0 0 ${chartWidth} ${loadChartHeight}`}
                      preserveAspectRatio="none"
                      className="w-full h-56 select-none cursor-crosshair block"
                      onMouseMove={handleLoadMouseMove}
                    >
                      <defs>
                        {/* CPU Linear Gradient Area */}
                        <linearGradient id="cpu-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                        {/* Memory Linear Gradient Area */}
                        <linearGradient id="mem-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Y-Gridlines */}
                      {loadYTicks.map((tick, i) => (
                        <g key={i}>
                          <line
                            x1={loadPadding.left}
                            y1={tick.y}
                            x2={chartWidth - loadPadding.right}
                            y2={tick.y}
                            stroke="currentColor"
                            className="text-rule/60"
                            strokeWidth="0.65"
                            strokeDasharray="2 4"
                          />
                          <text
                            x={loadPadding.left - 8}
                            y={tick.y + 3.5}
                            textAnchor="end"
                            className="fill-ink-muted text-[10px] font-mono"
                          >
                            {tick.val}%
                          </text>
                        </g>
                      ))}

                      {/* Floor Baseline */}
                      <line
                        x1={loadPadding.left}
                        y1={loadBaseY}
                        x2={chartWidth - loadPadding.right}
                        y2={loadBaseY}
                        stroke="currentColor"
                        className="text-rule"
                        strokeWidth="0.8"
                      />

                      {/* Floor Timeline Ticks */}
                      {loadXTickIndices.map((idx, i) => {
                        const xPos = getLoadX(idx);
                        const t = loadTimestamps[idx];
                        return (
                          <g key={i}>
                            <line
                              x1={xPos}
                              y1={loadBaseY}
                              x2={xPos}
                              y2={loadBaseY + 5}
                              stroke="currentColor"
                              className="text-rule"
                              strokeWidth="0.8"
                            />
                            <text
                              x={xPos}
                              y={loadChartHeight - 6}
                              textAnchor={
                                i === 0
                                  ? "start"
                                  : i === loadXTickIndices.length - 1
                                  ? "end"
                                  : "middle"
                              }
                              className="fill-ink-muted text-[10px] font-mono"
                            >
                              {formatTimeTick(t)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Memory Area Fill */}
                      {(() => {
                        const pts = loadData.mem.map((val, i) => ({
                          x: getLoadX(i),
                          y: getLoadY(val),
                        }));
                        return (
                          <path
                            d={generateAreaPath(pts, loadBaseY, isSmooth)}
                            fill="url(#mem-grad)"
                            className="pointer-events-none"
                          />
                        );
                      })()}

                      {/* CPU Area Fill */}
                      {(() => {
                        const pts = loadData.cpu.map((val, i) => ({
                          x: getLoadX(i),
                          y: getLoadY(val),
                        }));
                        return (
                          <path
                            d={generateAreaPath(pts, loadBaseY, isSmooth)}
                            fill="url(#cpu-grad)"
                            className="pointer-events-none"
                          />
                        );
                      })()}

                      {/* Disk Line (Subtle dashed hairline) */}
                      {(() => {
                        const pts = loadData.disk.map((val, i) => ({
                          x: getLoadX(i),
                          y: getLoadY(val),
                        }));
                        return (
                          <path
                            d={generatePath(pts, false)}
                            fill="none"
                            stroke="#c084fc"
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                            opacity="0.75"
                          />
                        );
                      })()}

                      {/* Memory Line */}
                      {(() => {
                        const pts = loadData.mem.map((val, i) => ({
                          x: getLoadX(i),
                          y: getLoadY(val),
                        }));
                        return (
                          <path
                            d={generatePath(pts, isSmooth)}
                            fill="none"
                            stroke="#818cf8"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.9"
                          />
                        );
                      })()}

                      {/* CPU Line */}
                      {(() => {
                        const pts = loadData.cpu.map((val, i) => ({
                          x: getLoadX(i),
                          y: getLoadY(val),
                        }));
                        return (
                          <path
                            d={generatePath(pts, isSmooth)}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      })()}

                      {/* Peak CPU Marker Bead */}
                      {peakCpuVal > 0 && (
                        <g className="pointer-events-none">
                          <circle
                            cx={getLoadX(peakCpuIdx)}
                            cy={getLoadY(peakCpuVal)}
                            r="3.5"
                            fill="#38bdf8"
                            stroke="var(--color-paper-2)"
                            strokeWidth="2"
                          />
                          <text
                            x={getLoadX(peakCpuIdx)}
                            y={getLoadY(peakCpuVal) - 8}
                            textAnchor="middle"
                            className="fill-sky-400 text-[9px] font-mono font-bold"
                          >
                            {peakCpuVal}%
                          </text>
                        </g>
                      )}

                      {/* Interactive Crosshair & Cursor */}
                      {loadHoverIdx !== null && loadHoverIdx >= 0 && (
                        <g className="pointer-events-none">
                          <line
                            x1={getLoadX(loadHoverIdx)}
                            y1={loadPadding.top}
                            x2={getLoadX(loadHoverIdx)}
                            y2={loadBaseY}
                            stroke="currentColor"
                            className="text-accent/80"
                            strokeWidth="1"
                            strokeDasharray="2 3"
                          />
                          {/* CPU hover bead */}
                          <circle
                            cx={getLoadX(loadHoverIdx)}
                            cy={getLoadY(loadData.cpu[loadHoverIdx])}
                            r="4"
                            fill="#38bdf8"
                            stroke="var(--color-paper-2)"
                            strokeWidth="2"
                          />
                          {/* Memory hover bead */}
                          <circle
                            cx={getLoadX(loadHoverIdx)}
                            cy={getLoadY(loadData.mem[loadHoverIdx])}
                            r="3.5"
                            fill="#818cf8"
                            stroke="var(--color-paper-2)"
                            strokeWidth="2"
                          />
                        </g>
                      )}
                    </svg>

                    {/* Hover Floating Tooltip */}
                    {loadHoverIdx !== null && loadTimestamps[loadHoverIdx] && (
                      <div
                        className={`absolute top-2 z-30 p-3 rounded-xl bg-paper-2/95 border border-rule shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-150 pointer-events-none min-w-[180px] space-y-2 ${
                          loadHoverIdx >= loadPointsCount / 2
                            ? "left-16 right-auto"
                            : "right-4 left-auto"
                        }`}
                      >
                        <div className="text-[11px] text-ink-muted border-b border-rule pb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-ink-muted" />
                            <span>采样时刻</span>
                          </span>
                          <span className="font-semibold text-ink">
                            {formatTimeTick(loadTimestamps[loadHoverIdx])}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-sky-400">
                              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                              <span>CPU 占用</span>
                            </span>
                            <span className="font-bold text-ink">
                              {loadData.cpu[loadHoverIdx]}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-indigo-400">
                              <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                              <span>物理内存</span>
                            </span>
                            <span className="font-bold text-ink">
                              {loadData.mem[loadHoverIdx]}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-purple-400">
                              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                              <span>磁盘存储</span>
                            </span>
                            <span className="font-bold text-ink">
                              {loadData.disk[loadHoverIdx]}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-56 flex items-center justify-center text-xs font-mono text-ink-muted">
                    正在采样硬件负载时序...
                  </div>
                )}

                {/* Sub-track: Network Throughput Stream (下行/上行网络吞吐趋势) */}
                {loadData && loadData.netIn && (
                  <div className="mt-4 pt-4 border-t border-rule/60">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-xs font-semibold text-ink font-sans flex items-center gap-2">
                        <span>网卡时序吞吐带宽</span>
                        <span className="text-[10px] font-mono text-ink-muted">
                          峰值 {formatNetSpeed(maxNetBytes)}
                        </span>
                      </span>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-ink-muted">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-2 h-1 rounded-xs bg-emerald-400" />
                          <span>下行 (Rx)</span>
                        </span>
                        <span className="flex items-center gap-1 text-sky-400">
                          <span className="w-2 h-1 rounded-xs bg-sky-400" />
                          <span>上行 (Tx)</span>
                        </span>
                      </div>
                    </div>

                    <div
                      className="w-full overflow-x-auto relative"
                      onMouseLeave={() => setNetHoverIdx(null)}
                    >
                      <svg
                        ref={netSvgRef}
                        viewBox={`0 0 ${chartWidth} ${netChartHeight}`}
                        preserveAspectRatio="none"
                        className="w-full h-28 select-none cursor-crosshair block"
                        onMouseMove={handleNetMouseMove}
                      >
                        <defs>
                          <linearGradient id="netin-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                          <linearGradient id="netout-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.20" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Midline & Floor */}
                        <line
                          x1={netPadding.left}
                          y1={netPadding.top + netInnerHeight / 2}
                          x2={chartWidth - netPadding.right}
                          y2={netPadding.top + netInnerHeight / 2}
                          stroke="currentColor"
                          className="text-rule/40"
                          strokeWidth="0.6"
                          strokeDasharray="2 4"
                        />
                        <line
                          x1={netPadding.left}
                          y1={netBaseY}
                          x2={chartWidth - netPadding.right}
                          y2={netBaseY}
                          stroke="currentColor"
                          className="text-rule"
                          strokeWidth="0.8"
                        />

                        {/* NetIn Downlink Area */}
                        {(() => {
                          const pts = loadData.netIn.map((bytes, i) => ({
                            x: getLoadX(i),
                            y: getNetY(bytes),
                          }));
                          return (
                            <path
                              d={generateAreaPath(pts, netBaseY, isSmooth)}
                              fill="url(#netin-grad)"
                            />
                          );
                        })()}

                        {/* NetIn Downlink Line */}
                        {(() => {
                          const pts = loadData.netIn.map((bytes, i) => ({
                            x: getLoadX(i),
                            y: getNetY(bytes),
                          }));
                          return (
                            <path
                              d={generatePath(pts, isSmooth)}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          );
                        })()}

                        {/* NetOut Uplink Line */}
                        {(() => {
                          const pts = loadData.netOut.map((bytes, i) => ({
                            x: getLoadX(i),
                            y: getNetY(bytes),
                          }));
                          return (
                            <path
                              d={generatePath(pts, isSmooth)}
                              fill="none"
                              stroke="#06b6d4"
                              strokeWidth="1.4"
                              strokeDasharray="4 2"
                            />
                          );
                        })()}

                        {/* Y-axis labels */}
                        <text
                          x={netPadding.left - 8}
                          y={netPadding.top + 6}
                          textAnchor="end"
                          className="fill-ink-muted text-[9px] font-mono"
                        >
                          {formatNetSpeed(maxNetBytes)}
                        </text>
                        <text
                          x={netPadding.left - 8}
                          y={netBaseY + 2}
                          textAnchor="end"
                          className="fill-ink-muted text-[9px] font-mono"
                        >
                          0
                        </text>

                        {/* Interactive Crosshair & Cursor */}
                        {netHoverIdx !== null && netHoverIdx >= 0 && (
                          <g className="pointer-events-none">
                            <line
                              x1={getLoadX(netHoverIdx)}
                              y1={netPadding.top}
                              x2={getLoadX(netHoverIdx)}
                              y2={netBaseY}
                              stroke="currentColor"
                              className="text-accent/80"
                              strokeWidth="1"
                              strokeDasharray="2 3"
                            />
                            {/* Downlink bead (Rx) */}
                            <circle
                              cx={getLoadX(netHoverIdx)}
                              cy={getNetY(loadData.netIn[netHoverIdx])}
                              r="4"
                              fill="#10b981"
                              stroke="var(--color-paper-2)"
                              strokeWidth="2"
                            />
                            {/* Uplink bead (Tx) */}
                            <circle
                              cx={getLoadX(netHoverIdx)}
                              cy={getNetY(loadData.netOut[netHoverIdx])}
                              r="3.5"
                              fill="#06b6d4"
                              stroke="var(--color-paper-2)"
                              strokeWidth="2"
                            />
                          </g>
                        )}
                      </svg>

                      {/* Net Hover Floating Tooltip */}
                      {netHoverIdx !== null && loadTimestamps[netHoverIdx] && (
                        <div
                          className={`absolute top-2 z-30 p-2.5 rounded-xl bg-paper-2/95 border border-rule shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-150 pointer-events-none min-w-[170px] space-y-1.5 ${
                            netHoverIdx >= loadPointsCount / 2
                              ? "left-16 right-auto"
                              : "right-4 left-auto"
                          }`}
                        >
                          <div className="text-[11px] text-ink-muted border-b border-rule pb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-ink-muted" />
                              <span>采样时刻</span>
                            </span>
                            <span className="font-semibold text-ink">
                              {formatTimeTick(loadTimestamps[netHoverIdx])}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                <span>下行 (Rx)</span>
                              </span>
                              <span className="font-bold text-ink">
                                {formatNetSpeed(loadData.netIn[netHoverIdx])}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 text-sky-400">
                                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                                <span>上行 (Tx)</span>
                              </span>
                              <span className="font-bold text-ink">
                                {formatNetSpeed(loadData.netOut[netHoverIdx])}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. 底层控制栏与来源行 (src: 全大写 · 加字距) */}
                <div className="mt-4 pt-3 border-t border-rule flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  {/* Left Controls: 平滑开关 */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSmooth}
                      onClick={() => setIsSmooth((prev) => !prev)}
                      className="flex items-center gap-2 cursor-pointer select-none group focus:outline-hidden"
                    >
                      <div
                        className={`relative inline-flex h-4 w-8 shrink-0 items-center p-0.5 rounded-full transition-colors duration-200 ease-in-out ${
                          isSmooth ? "bg-accent" : "bg-paper-3 border border-rule"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                            isSmooth ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </div>
                      <span className="text-xs text-ink-secondary group-hover:text-ink transition-colors font-sans font-medium">
                        贝塞尔平滑
                      </span>
                    </button>
                    <span title="开启贝塞尔曲线平滑展示，关闭则展示直连折线">
                      <Info className="w-3.5 h-3.5 text-ink-muted cursor-help" />
                    </span>
                  </div>

                  {/* Right Source Line */}
                  <div className="text-[10px] font-mono text-ink-muted tracking-wider uppercase">
                    LINUX KERNEL SYSSTAT · /PROC/STAT & /PROC/MEMINFO · 10S POLLING
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
