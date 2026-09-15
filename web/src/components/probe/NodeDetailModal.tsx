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
  Sliders,
  ChartLine,
} from "@phosphor-icons/react";
import { NodeItem, NodeLatencyHistory } from "../../types";
import { Badge } from "../common/Badge";

interface NodeDetailModalProps {
  node: NodeItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  node,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"latency" | "load">("latency");
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "12h" | "1d">("1h");
  const [isSmooth, setIsSmooth] = useState(true);
  const [hiddenTargets, setHiddenTargets] = useState<string[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Latency & Load Data State
  const [latencyData, setLatencyData] = useState<NodeLatencyHistory[]>([]);
  const [loadData, setLoadData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch latency history
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

  // Calculate chart boundaries
  const chartWidth = 920;
  const chartHeight = 300;
  const padding = { top: 25, right: 30, bottom: 35, left: 55 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  let maxLatency = 60;
  visibleSeries.forEach((s) => {
    s.history.forEach((pt) => {
      if (pt.latencyMs > maxLatency) maxLatency = pt.latencyMs;
    });
  });
  maxLatency = Math.ceil((maxLatency * 1.15) / 10) * 10;
  const minLatency = 0;

  const pointsCount =
    visibleSeries[0]?.history.length ||
    (timeRange === "1h" ? 60 : timeRange === "1d" ? 96 : 72);

  const getX = (index: number) => {
    return padding.left + (index / (pointsCount - 1 || 1)) * innerWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(minLatency, Math.min(maxLatency, val));
    return (
      padding.top +
      innerHeight -
      ((clamped - minLatency) / (maxLatency - minLatency || 1)) * innerHeight
    );
  };

  // Generate SVG path string (smooth Bézier vs straight line)
  const generatePath = (history: { latencyMs: number }[]) => {
    if (!history || history.length === 0) return "";
    const pts = history.map((pt, i) => ({ x: getX(i), y: getY(pt.latencyMs) }));

    if (!isSmooth || pts.length < 3) {
      return pts.reduce(
        (acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
        ""
      );
    }

    // Catmull-Rom or cubic bezier smooth curve
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

  // Y-axis ticks
  const yTicksCount = 5;
  const yTicks = Array.from({ length: yTicksCount }, (_, i) => {
    const val = Math.round(minLatency + (i / (yTicksCount - 1)) * (maxLatency - minLatency));
    return { val, y: getY(val) };
  });

  // X-axis timestamps format
  const formatTimeTick = (timestamp?: number) => {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const sampleTimestamps =
    visibleSeries[0]?.history.map((h) => h.timestamp) || [];
  const xTickIndices = [
    0,
    Math.floor(pointsCount * 0.25),
    Math.floor(pointsCount * 0.5),
    Math.floor(pointsCount * 0.75),
    pointsCount - 1,
  ];

  // Mouse move handler for crosshair
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || pointsCount <= 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    const relX = svgX - padding.left;
    const frac = Math.max(0, Math.min(1, relX / innerWidth));
    const idx = Math.round(frac * (pointsCount - 1));
    setHoverIndex(idx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-paper/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-paper-2 border border-rule rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule bg-paper/40">
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {node.country === "HK" ? "🇭🇰" : node.country === "JP" ? "🇯🇵" : "🇺🇸"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink tracking-tight">
                  {node.name}
                </h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule font-mono">
                  {node.ip}:{node.port}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-secondary border border-rule">
                  {node.os || "Debian 12"}
                </span>
              </div>
              <div className="text-[11px] font-mono text-ink-muted flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>运行时长: {node.uptime || "28天 14小时"}</span>
                </span>
                <span>•</span>
                <span>架构: {node.arch || "x86_64"}</span>
                <span>•</span>
                <span>带宽高峰: {node.bandwidthMbps ? `${node.bandwidthMbps} Mbps` : "1 Gbps"}</span>
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
              className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-paper-hover transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Controls Toolbar: [负载 | 延迟] & [1小时 | 6小时 | 12小时 | 1天] */}
        <div className="px-6 py-3 border-b border-rule flex flex-col sm:flex-row items-center justify-between gap-3 bg-paper/20">
          {/* Segmented Mode Switch (Matches Screenshot: 负载 | 延迟) */}
          <div className="flex items-center bg-paper p-0.5 rounded-lg border border-rule shadow-xs">
            <button
              onClick={() => setActiveTab("load")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === "load"
                  ? "bg-paper-2 text-ink shadow-xs font-semibold border border-rule"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              负载
            </button>
            <button
              onClick={() => setActiveTab("latency")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === "latency"
                  ? "bg-paper-2 text-accent shadow-xs font-semibold border border-rule"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              延迟
            </button>
          </div>

          {/* Time Range Selector (Matches Screenshot: 1小时 | 6小时 | 12小时 | 1天) */}
          <div className="flex items-center gap-1 bg-paper p-0.5 rounded-lg border border-rule">
            {(
              [
                { id: "1h", label: "1 小时" },
                { id: "6h", label: "6 小时" },
                { id: "12h", label: "12 小时" },
                { id: "1d", label: "1 天" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer ${
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
        <div className="p-6 space-y-5">
          {/* TAB 1: LATENCY VIEW (Matches Screenshot media_1789477107377.png) */}
          {activeTab === "latency" && (
            <div className="space-y-4">
              {/* Target Cards Grid (Matches screenshot legend cards with left colored bar) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {latencyData.map((task) => {
                  const isHidden = hiddenTargets.includes(task.taskName);
                  return (
                    <div
                      key={task.taskId}
                      onClick={() => toggleTarget(task.taskName)}
                      className={`relative p-2.5 rounded-lg bg-paper border transition-all cursor-pointer select-none overflow-hidden ${
                        isHidden
                          ? "opacity-40 border-rule"
                          : "border-rule hover:border-rule-active shadow-xs"
                      }`}
                      title="点击隐藏/显示折线"
                    >
                      {/* Left Colored Accent Bar */}
                      <span
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                        style={{ backgroundColor: task.color }}
                      />

                      <div className="pl-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink truncate max-w-[90px]">
                            {task.taskName} ···
                          </span>
                          <span
                            className="font-mono text-[11px] font-bold"
                            style={{ color: task.color }}
                          >
                            {task.currentLatency} ms
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-ink-muted mt-1 flex items-center justify-between">
                          <span>- {task.lossRate.toFixed(1)}%丢包</span>
                          <span>{task.jitter.toFixed(1)}波动</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Multi-Line Latency Time Series Chart */}
              <div className="relative rounded-xl bg-paper-3/50 border border-rule p-3 overflow-hidden">
                {loading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/60 backdrop-blur-xs text-xs text-ink-muted">
                    <span>加载延迟采样数据中...</span>
                  </div>
                )}

                {/* SVG Chart */}
                <div className="w-full overflow-x-auto">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-64 select-none cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Horizontal Y-Gridlines and Tick Labels */}
                    {yTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          x1={padding.left}
                          y1={tick.y}
                          x2={chartWidth - padding.right}
                          y2={tick.y}
                          stroke="currentColor"
                          className="text-rule/60"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padding.left - 8}
                          y={tick.y + 3}
                          textAnchor="end"
                          className="fill-ink-muted text-[10px] font-mono"
                        >
                          {tick.val} ms
                        </text>
                      </g>
                    ))}

                    {/* X-axis Tick Labels */}
                    {xTickIndices.map((idx, i) => {
                      const xPos = getX(idx);
                      const t = sampleTimestamps[idx];
                      return (
                        <text
                          key={i}
                          x={xPos}
                          y={chartHeight - 10}
                          textAnchor={i === 0 ? "start" : i === xTickIndices.length - 1 ? "end" : "middle"}
                          className="fill-ink-muted text-[10px] font-mono"
                        >
                          {formatTimeTick(t)}
                        </text>
                      );
                    })}

                    {/* Target Data Series Paths */}
                    {visibleSeries.map((series) => {
                      const d = generatePath(series.history);
                      return (
                        <g key={series.taskId}>
                          <path
                            d={d}
                            fill="none"
                            stroke={series.color}
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="transition-all duration-300 opacity-90 hover:opacity-100 hover:stroke-[2.5]"
                          />
                        </g>
                      );
                    })}

                    {/* Interactive Crosshair Cursor */}
                    {hoverIndex !== null && hoverIndex >= 0 && (
                      <g>
                        <line
                          x1={getX(hoverIndex)}
                          y1={padding.top}
                          x2={getX(hoverIndex)}
                          y2={chartHeight - padding.bottom}
                          stroke="#38bdf8"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        {visibleSeries.map((series) => {
                          const pt = series.history[hoverIndex];
                          if (!pt) return null;
                          return (
                            <circle
                              key={series.taskId}
                              cx={getX(hoverIndex)}
                              cy={getY(pt.latencyMs)}
                              r="3.5"
                              fill={series.color}
                              stroke="#0f172a"
                              strokeWidth="1.5"
                            />
                          );
                        })}
                      </g>
                    )}
                  </svg>

                  {/* Hover Floating Tooltip */}
                  {hoverIndex !== null && sampleTimestamps[hoverIndex] && (
                    <div
                      className="absolute top-4 right-4 z-20 p-3 rounded-lg bg-paper-2/95 border border-rule shadow-xl text-xs font-mono pointer-events-none min-w-[160px] space-y-1.5 backdrop-blur-sm"
                    >
                      <div className="text-[11px] text-ink-muted border-b border-rule pb-1 flex items-center justify-between">
                        <span>时间采样点</span>
                        <span className="font-semibold text-ink">
                          {formatTimeTick(sampleTimestamps[hoverIndex])}
                        </span>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {visibleSeries.map((series) => {
                          const pt = series.history[hoverIndex];
                          if (!pt) return null;
                          return (
                            <div
                              key={series.taskId}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <span
                                className="flex items-center gap-1.5"
                                style={{ color: series.color }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: series.color }}
                                />
                                <span className="truncate max-w-[80px]">
                                  {series.taskName}
                                </span>
                              </span>
                              <span className="font-bold text-ink">
                                {pt.latencyMs} ms
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Chart Toolbar (Matches Screenshot: 平滑开关 & 隐藏全部) */}
                <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-xs text-ink-muted">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setIsSmooth(!isSmooth)}
                        className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
                          isSmooth ? "bg-accent" : "bg-paper-3 border border-rule"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-paper absolute top-0.5 transition-transform ${
                            isSmooth ? "left-4.5" : "left-0.5"
                          }`}
                        />
                      </div>
                      <span className="text-xs text-ink-secondary">平滑</span>
                    </label>
                    <span title="开启贝塞尔曲线平滑展示，关闭则展示直连折线">
                      <Info className="w-3.5 h-3.5 text-ink-muted cursor-help" />
                    </span>
                  </div>

                  <button
                    onClick={toggleAllTargets}
                    className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink px-2 py-1 rounded hover:bg-paper-2 transition-colors cursor-pointer"
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
              </div>
            </div>
          )}

          {/* TAB 2: HARDWARE LOAD VIEW */}
          {activeTab === "load" && (
            <div className="space-y-4 font-mono">
              {/* Real-time Hardware Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-paper border border-rule">
                  <div className="text-[11px] text-ink-muted flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-accent" />
                    <span>实时 CPU 占用</span>
                  </div>
                  <div className="text-lg font-bold text-ink mt-1">
                    {node.cpuUsage}%
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5">
                    Load: {node.loadAvg ? node.loadAvg.join(", ") : "0.15, 0.22, 0.18"}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-paper border border-rule">
                  <div className="text-[11px] text-ink-muted flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                    <span>物理内存负载</span>
                  </div>
                  <div className="text-lg font-bold text-ink mt-1">
                    {node.memUsage}%
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5">
                    {node.memTotalBytes
                      ? `${(node.memTotalBytes / 1073741824).toFixed(1)} GB 总量`
                      : "2.0 GB"}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-paper border border-rule">
                  <div className="text-[11px] text-ink-muted flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                    <span>硬盘存储占用</span>
                  </div>
                  <div className="text-lg font-bold text-ink mt-1">
                    {node.diskUsage}%
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5">
                    {node.diskTotalBytes
                      ? `${(node.diskTotalBytes / 1073741824).toFixed(0)} GB 空间`
                      : "40 GB"}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-paper border border-rule">
                  <div className="text-[11px] text-ink-muted flex items-center gap-1.5">
                    <Lightning className="w-3.5 h-3.5 text-emerald-400" />
                    <span>实时网速吞吐</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" />
                    <span>{((node.downlinkSpeedBytes || 0) / 1024).toFixed(0)} KB/s</span>
                  </div>
                  <div className="text-[11px] font-bold text-sky-400 mt-0.5 flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    <span>{((node.uplinkSpeedBytes || 0) / 1024).toFixed(0)} KB/s</span>
                  </div>
                </div>
              </div>

              {/* Hardware Load Trends Chart */}
              <div className="p-4 rounded-xl bg-paper-3/50 border border-rule space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">
                    综合硬件时序负载 ({timeRange} 趋势)
                  </span>
                  <div className="flex items-center gap-4 text-[11px] text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-accent" />
                      <span>CPU (%)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-sky-400" />
                      <span>内存 (%)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-purple-400" />
                      <span>磁盘 (%)</span>
                    </span>
                  </div>
                </div>

                {/* SVG Load Chart */}
                {loadData ? (
                  <svg
                    viewBox={`0 0 ${chartWidth} 220`}
                    className="w-full h-52 select-none"
                  >
                    {/* Gridlines */}
                    {[0, 25, 50, 75, 100].map((pct, i) => {
                      const y = 20 + 160 - (pct / 100) * 160;
                      return (
                        <g key={i}>
                          <line
                            x1={padding.left}
                            y1={y}
                            x2={chartWidth - padding.right}
                            y2={y}
                            stroke="currentColor"
                            className="text-rule/60"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={padding.left - 8}
                            y={y + 3}
                            textAnchor="end"
                            className="fill-ink-muted text-[10px]"
                          >
                            {pct}%
                          </text>
                        </g>
                      );
                    })}

                    {/* CPU Path */}
                    <path
                      d={loadData.cpu.reduce(
                        (acc: string, val: number, i: number) => {
                          const x = getX(i);
                          const y = 20 + 160 - (val / 100) * 160;
                          return `${acc} ${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
                        },
                        ""
                      )}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />

                    {/* Memory Path */}
                    <path
                      d={loadData.mem.reduce(
                        (acc: string, val: number, i: number) => {
                          const x = getX(i);
                          const y = 20 + 160 - (val / 100) * 160;
                          return `${acc} ${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
                        },
                        ""
                      )}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="2"
                    />

                    {/* Disk Path */}
                    <path
                      d={loadData.disk.reduce(
                        (acc: string, val: number, i: number) => {
                          const x = getX(i);
                          const y = 20 + 160 - (val / 100) * 160;
                          return `${acc} ${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
                        },
                        ""
                      )}
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                  </svg>
                ) : (
                  <div className="h-52 flex items-center justify-center text-xs text-ink-muted">
                    正在采样硬件负载时序...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
