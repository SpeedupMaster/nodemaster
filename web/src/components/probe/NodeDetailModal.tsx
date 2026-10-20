import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
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
import { api } from "../../services/api";

// Line colours for latency targets, assigned by position
const SERIES_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];
type LatencySeries = NodeLatencyHistory & { color: string };
type LoadHistory = { timestamps: number[]; cpu: number[]; mem: number[]; disk: number[]; netIn: number[]; netOut: number[] };

gsap.registerPlugin(useGSAP);

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
  const [isSmooth, setIsSmooth] = useState(false); // 默认关闭贝塞尔平滑，真实展示网络抖动与原生采样点
  const [peakMetric, setPeakMetric] = useState<"cpu" | "mem" | "disk">("cpu");
  const [hiddenTargets, setHiddenTargets] = useState<string[]>([]);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [latencyHoverIdx, setLatencyHoverIdx] = useState<number | null>(null);
  const [loadHoverIdx, setLoadHoverIdx] = useState<number | null>(null);
  const [netHoverIdx, setNetHoverIdx] = useState<number | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [touchDeltaY, setTouchDeltaY] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggered = useRef(false);

  // Latency & Load Data State
  const [latencyData, setLatencyData] = useState<LatencySeries[]>([]);
  const [loadData, setLoadData] = useState<LoadHistory | null>(null);
  const [loading, setLoading] = useState(false);

  const latencySvgRef = useRef<SVGSVGElement>(null);
  const loadSvgRef = useRef<SVGSVGElement>(null);
  const netSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Reset touch state and lock body scroll
  useEffect(() => {
    if (!isOpen) {
      setTouchDeltaY(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useGSAP(() => {
    if (isOpen) {
      if (overlayRef.current && modalRef.current) {
        gsap.fromTo(
          overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.2, ease: "power2.out" }
        );
        gsap.fromTo(
          modalRef.current,
          { opacity: 0, scale: 0.97, y: 16 },
          { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: "power3.out" }
        );
      }
    }
  }, { dependencies: [isOpen] });

  // Swipe-down touch gesture handlers (for mobile Bottom Sheet dismiss)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartYRef.current;
    if (diff > 0) {
      setTouchDeltaY(Math.min(diff * 0.65, 140));
    }
  };

  const handleTouchEnd = () => {
    if (touchDeltaY > 60) {
      onClose();
    }
    setTouchDeltaY(0);
    touchStartYRef.current = null;
  };

  // Fetch latency history or load history
  useEffect(() => {
    if (!node || !isOpen) return;
    setLoading(true);
    setLatencyData([]);
    setLoadData(null);
    const controller = new AbortController();

    const request =
      activeTab === "latency"
        ? api<NodeLatencyHistory[]>("GET", `/api/ping/node-history/${node.id}?range=${timeRange}`, undefined, controller.signal).then(
            (series) => setLatencyData(series.map((s, i) => ({ ...s, color: SERIES_COLORS[i % SERIES_COLORS.length] }))),
          )
        : api<LoadHistory>("GET", `/api/nodes/${node.id}/history?range=${timeRange}`, undefined, controller.signal).then((history) =>
            setLoadData(history?.timestamps?.length ? history : null),
          );
    request
      .catch((err) => {
        if (!controller.signal.aborted) console.error(`Fetch ${activeTab} history failed:`, err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
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

  // Solo mode handler (long press on card or solo click)
  const handleSoloTarget = (taskName: string) => {
    const otherTargets = latencyData
      .filter((d) => d.taskName !== taskName)
      .map((d) => d.taskName);
    const isCurrentlySolo =
      hiddenTargets.length === otherTargets.length &&
      !hiddenTargets.includes(taskName) &&
      otherTargets.every((t) => hiddenTargets.includes(t));

    if (isCurrentlySolo) {
      // 再次触发恢复全显
      setHiddenTargets([]);
    } else {
      // 独显此线路
      setHiddenTargets(otherTargets);
    }
  };

  const handleCardMouseDown = (taskName: string) => {
    isLongPressTriggered.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      handleSoloTarget(taskName);
    }, 450);
  };

  const handleCardMouseUp = (taskName: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressTriggered.current) {
      toggleTarget(taskName);
    }
  };

  const handleCardMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCardTouchStart = (taskName: string) => {
    isLongPressTriggered.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      handleSoloTarget(taskName);
    }, 450);
  };

  const handleCardTouchEnd = (taskName: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressTriggered.current) {
      toggleTarget(taskName);
    }
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
  const latencyPadding = { top: 25, right: 30, bottom: 35, left: 62 };
  const latencyChartHeight = 300;
  const latencyInnerWidth = chartWidth - latencyPadding.left - latencyPadding.right;
  const latencyInnerHeight = latencyChartHeight - latencyPadding.top - latencyPadding.bottom;
  const latencyBaseY = latencyChartHeight - latencyPadding.bottom;

  let detectedMax = 0;
  visibleSeries.forEach((s) => {
    s.history.forEach((pt) => {
      if (pt.latencyMs > detectedMax) detectedMax = pt.latencyMs;
    });
  });
  // Y 轴自适应动态缩放：如果隐藏节点后最高只有 20ms，上限自动回落至 ~25ms，让剩余曲线充分舒展
  const maxLatency = detectedMax > 0
    ? Math.max(10, Math.ceil((detectedMax * 1.15) / 5) * 5)
    : 20;
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

  const handleLatencyTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!latencySvgRef.current || latencyPointsCount <= 0 || !e.touches[0]) return;
    const rect = latencySvgRef.current.getBoundingClientRect();
    const svgX = ((e.touches[0].clientX - rect.left) / rect.width) * chartWidth;
    const relX = svgX - latencyPadding.left;
    const frac = Math.max(0, Math.min(1, relX / latencyInnerWidth));
    const idx = Math.round(frac * (latencyPointsCount - 1));
    setLatencyHoverIdx(idx);
  };

  // ==========================================
  // HARDWARE LOAD CHART CALCULATIONS
  // ==========================================
  const loadPadding = { top: 25, right: 30, bottom: 32, left: 62 };
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

  const handleLoadTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!loadSvgRef.current || loadPointsCount <= 0 || !e.touches[0]) return;
    const rect = loadSvgRef.current.getBoundingClientRect();
    const svgX = ((e.touches[0].clientX - rect.left) / rect.width) * chartWidth;
    const relX = svgX - loadPadding.left;
    const frac = Math.max(0, Math.min(1, relX / loadInnerWidth));
    const idx = Math.round(frac * (loadPointsCount - 1));
    setLoadHoverIdx(idx);
  };

  // Find Peak Points for CPU, Memory, and Disk
  let peakCpuIdx = 0;
  let peakCpuVal = 0;
  let peakMemIdx = 0;
  let peakMemVal = 0;
  let peakDiskIdx = 0;
  let peakDiskVal = 0;

  if (loadData) {
    loadData.cpu?.forEach((v, i) => {
      if (v > peakCpuVal) {
        peakCpuVal = v;
        peakCpuIdx = i;
      }
    });
    loadData.mem?.forEach((v, i) => {
      if (v > peakMemVal) {
        peakMemVal = v;
        peakMemIdx = i;
      }
    });
    loadData.disk?.forEach((v, i) => {
      if (v > peakDiskVal) {
        peakDiskVal = v;
        peakDiskIdx = i;
      }
    });
  }

  // ==========================================
  // NETWORK I/O: MIRRORED BUTTERFLY CHART
  // ==========================================
  // Tx (上行) 向上生长，Rx (下行) 向下生长，中央水平基线为 0
  const netChartHeight = 152;
  const netPadding = { top: 22, right: 30, bottom: 22, left: 62 };
  const netInnerWidth = chartWidth - netPadding.left - netPadding.right;
  const netInnerHeight = netChartHeight - netPadding.top - netPadding.bottom;
  const netCenterY = netPadding.top + netInnerHeight / 2;
  const netHalfHeight = netInnerHeight / 2;

  let maxNetBytes = 102400; // 100 KB/s min floor
  if (loadData) {
    [...loadData.netIn, ...loadData.netOut].forEach((b) => {
      if (b > maxNetBytes) maxNetBytes = b;
    });
  }
  maxNetBytes = Math.ceil((maxNetBytes * 1.25) / 10240) * 10240;

  // 上行 Tx 向上生长
  const getNetTxY = (bytes: number) => {
    const clamped = Math.max(0, Math.min(maxNetBytes, bytes));
    return netCenterY - (clamped / maxNetBytes) * netHalfHeight;
  };

  // 下行 Rx 向下生长
  const getNetRxY = (bytes: number) => {
    const clamped = Math.max(0, Math.min(maxNetBytes, bytes));
    return netCenterY + (clamped / maxNetBytes) * netHalfHeight;
  };

  const handleNetMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!netSvgRef.current || loadPointsCount <= 0) return;
    const rect = netSvgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    const relX = svgX - netPadding.left;
    const frac = Math.max(0, Math.min(1, relX / netInnerWidth));
    const idx = Math.round(frac * (loadPointsCount - 1));
    setNetHoverIdx(idx);
  };

  const handleNetTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!netSvgRef.current || loadPointsCount <= 0 || !e.touches[0]) return;
    const rect = netSvgRef.current.getBoundingClientRect();
    const svgX = ((e.touches[0].clientX - rect.left) / rect.width) * chartWidth;
    const relX = svgX - netPadding.left;
    const frac = Math.max(0, Math.min(1, relX / netInnerWidth));
    const idx = Math.round(frac * (loadPointsCount - 1));
    setNetHoverIdx(idx);
  };

  const formatNetSpeed = (bytes: number) => {
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(1)} MB/s`;
    }
    return `${(bytes / 1024).toFixed(0)} KB/s`;
  };

  if (!isOpen || !node) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-hidden sm:overflow-y-auto">
      {/* Full Viewport Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Body (Mobile Bottom Sheet / Desktop Dialog) */}
      <div
        ref={modalRef}
        style={{
          transform: touchDeltaY > 0 ? `translateY(${touchDeltaY}px)` : undefined,
          transition: touchDeltaY === 0 ? "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
        }}
        className="relative w-full max-w-5xl bg-paper-2 border-t sm:border border-rule rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] sm:max-h-[calc(100vh-3rem)] my-0 sm:my-auto"
      >
        {/* Mobile Drag Indicator Handle (iOS/Material Bottom Sheet Pill) */}
        <div
          className="sm:hidden pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none select-none bg-paper-2 shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-hidden="true"
        >
          <div className="w-10 h-1.5 bg-rule-active/80 hover:bg-rule-active rounded-full transition-colors" />
        </div>

        {/* Modal Header */}
        <div
          className="flex items-start sm:items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-rule bg-paper-2/95 backdrop-blur flex-shrink-0 gap-3"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl shrink-0 mt-0.5 sm:mt-0">
              {node.country === "HK" ? "🇭🇰" : node.country === "JP" ? "🇯🇵" : "🇺🇸"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-ink tracking-tight font-sans truncate">
                  {node.name}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule font-mono shrink-0">
                  {node.ip}:{node.port}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-sans shrink-0">
                  {node.os || "Debian 12"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-mono font-medium shrink-0 ${
                    (node.tcpCongestion || "bbr").toLowerCase() === "bbr"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                      : "bg-paper-3 text-ink-muted border-rule"
                  }`}
                  title="TCP 拥塞算法与内核调优状态"
                >
                  TCP: {(node.tcpCongestion || "bbr").toUpperCase()}
                </span>
              </div>
              <div className="text-[11px] font-mono text-ink-muted flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-ink-muted" />
                  <span>在线时长: {node.uptime || "28天 14小时"}</span>
                </span>
                <span>•</span>
                <span>架构: {node.arch || "x86_64"}</span>
                <span>•</span>
                <span>峰值带宽: {node.bandwidthMbps ? `${node.bandwidthMbps} Mbps` : "1 Gbps"}</span>
                {node.costAmount != null && node.costAmount > 0 && (
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

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Badge
              variant={node.status === "online" ? "online" : "danger"}
              size="sm"
              pulse={node.status === "online"}
            >
              {node.status === "online" ? "在线" : "离线"}
            </Badge>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors shrink-0 touch-manipulation cursor-pointer"
              aria-label="关闭弹窗"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Controls Toolbar */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-rule flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-paper/30 shrink-0">
          {/* Segmented Mode Switch: 负载 | 延迟 */}
          <div className="flex items-center bg-paper p-0.5 rounded-lg border border-rule shadow-xs shrink-0">
            <button
              onClick={() => setActiveTab("load")}
              className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer text-center ${
                activeTab === "load"
                  ? "bg-paper-2 text-accent font-bold shadow-xs border border-rule"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              综合负载
            </button>
            <button
              onClick={() => setActiveTab("latency")}
              className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer text-center ${
                activeTab === "latency"
                  ? "bg-paper-2 text-accent font-bold shadow-xs border border-rule"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              测速延迟
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-paper p-0.5 rounded-lg border border-rule overflow-x-auto shrink-0 pb-0.5 sm:pb-0">
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
                className={`px-2.5 sm:px-3 py-1 text-xs rounded-md transition-colors cursor-pointer font-mono shrink-0 ${
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
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 flex-1 min-h-0 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
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
                  const isSolo =
                    hiddenTargets.length === latencyData.length - 1 &&
                    !hiddenTargets.includes(task.taskName);

                  return (
                    <div
                      key={task.taskId}
                      onMouseDown={() => handleCardMouseDown(task.taskName)}
                      onMouseUp={() => handleCardMouseUp(task.taskName)}
                      onMouseLeave={() => {
                        handleCardMouseLeave();
                        setHoveredTarget(null);
                      }}
                      onTouchStart={() => handleCardTouchStart(task.taskName)}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleCardTouchEnd(task.taskName);
                      }}
                      onMouseEnter={() => setHoveredTarget(task.taskName)}
                      className={`relative p-2.5 rounded-xl bg-paper border transition-all cursor-pointer select-none overflow-hidden ${
                        isHidden
                          ? "opacity-35 border-rule grayscale"
                          : isSolo
                          ? "border-accent ring-2 ring-accent/40 bg-accent/5 shadow-md"
                          : isHovered
                          ? "border-accent/80 shadow-md ring-1 ring-accent/30 bg-paper-2"
                          : "border-rule hover:border-rule-active hover:bg-paper-hover shadow-xs"
                      }`}
                      title="点击切换折线显示；长按进入独显 (Solo) 模式"
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
                        <div className="flex items-center justify-between text-xs gap-1">
                          <span className="font-semibold text-ink truncate max-w-[85px] font-sans">
                            {task.taskName}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isSolo && (
                              <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-accent/20 text-accent">
                                SOLO
                              </span>
                            )}
                            <span
                              className="font-mono text-xs font-bold"
                              style={{ color: task.color }}
                            >
                              {task.currentLatency} ms
                            </span>
                          </div>
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
                    className="w-full h-72 select-none cursor-crosshair block touch-none"
                    onMouseMove={handleLatencyMouseMove}
                    onTouchStart={handleLatencyTouchMove}
                    onTouchMove={handleLatencyTouchMove}
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

                    {/* Horizontal Y-Gridlines (Hairline dashed ticks, contrast >= 3:1) */}
                    {latencyYTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          x1={latencyPadding.left}
                          y1={tick.y}
                          x2={chartWidth - latencyPadding.right}
                          y2={tick.y}
                          stroke="currentColor"
                          className="text-white/10"
                          strokeWidth="0.75"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={latencyPadding.left - 10}
                          y={tick.y + 3.5}
                          textAnchor="end"
                          className="fill-ink-secondary text-[10px] font-mono font-medium"
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
                      className="text-white/20"
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
                            className="text-white/20"
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
                            className="fill-ink-secondary text-[10px] font-mono font-medium"
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

                  {/* Hover Floating Tooltip with Dynamic Descending Sorting */}
                  {latencyHoverIdx !== null && latencyTimestamps[latencyHoverIdx] && (() => {
                    const sortedSeriesAtHover = [...visibleSeries].sort((a, b) => {
                      const latA = a.history[latencyHoverIdx]?.latencyMs ?? 0;
                      const latB = b.history[latencyHoverIdx]?.latencyMs ?? 0;
                      return latB - latA; // 动态倒序：当前时间切片下延迟最高的排最前
                    });

                    return (
                      <div
                        className={`absolute top-2 z-30 p-2.5 sm:p-3 rounded-xl bg-paper-2/95 border border-rule shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-150 pointer-events-auto max-w-[calc(100%-1.5rem)] ${
                          latencyHoverIdx >= latencyPointsCount / 2
                            ? "left-2 sm:left-16 right-auto"
                            : "right-2 sm:right-4 left-auto"
                        }`}
                        style={{
                          minWidth:
                            visibleSeries.length > 5
                              ? "min(320px, calc(100vw - 3rem))"
                              : "min(200px, calc(100vw - 3rem))",
                        }}
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
                              ? "grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5"
                              : "space-y-1.5"
                          }`}
                        >
                          {sortedSeriesAtHover.map((series, rankIdx) => {
                            const pt = series.history[latencyHoverIdx];
                            if (!pt) return null;
                            const isHovered = hoveredTarget === series.taskName;
                            const isWorst = rankIdx === 0 && pt.latencyMs > 0;
                            return (
                              <div
                                key={series.taskId}
                                onMouseEnter={() => setHoveredTarget(series.taskName)}
                                onMouseLeave={() => setHoveredTarget(null)}
                                className={`flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                  isHovered
                                    ? "bg-paper-3 font-bold ring-1 ring-accent/30"
                                    : isWorst
                                    ? "bg-red-500/10 border border-red-500/20"
                                    : "hover:bg-paper-3/50"
                                }`}
                              >
                                <span
                                  className="flex items-center gap-1.5 truncate max-w-[110px]"
                                  style={{ color: series.color }}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: series.color }}
                                  />
                                  <span className="truncate">{series.taskName}</span>
                                  {isWorst && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-red-500/20 text-red-400 font-bold shrink-0">
                                      最高
                                    </span>
                                  )}
                                </span>
                                <span className="font-bold text-ink ml-1.5">
                                  {pt.latencyMs} ms
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
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
                  <div className="text-[10px] font-mono text-[#7a7a7a] tracking-wider uppercase font-medium">
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
                    {peakMetric === "cpu" && peakCpuVal > 0 && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/10 text-sky-400">
                        CPU 峰值 {peakCpuVal}%
                      </span>
                    )}
                    {peakMetric === "mem" && peakMemVal > 0 && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-400">
                        内存 峰值 {peakMemVal}%
                      </span>
                    )}
                    {peakMetric === "disk" && peakDiskVal > 0 && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-zinc-400/40 bg-zinc-400/10 text-zinc-200">
                        磁盘 峰值 {peakDiskVal}%
                      </span>
                    )}
                  </h2>
                </div>

                {/* 2. 独立 Flex 图例与切换指示器 */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPeakMetric("cpu")}
                      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                        peakMetric === "cpu"
                          ? "bg-sky-500/15 text-sky-400 border border-sky-500/35 font-semibold shadow-xs"
                          : "bg-paper border border-rule text-ink-muted hover:text-ink hover:bg-paper-2"
                      }`}
                      title="点击聚焦 CPU 并切换峰值展示"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#00a2ff] shrink-0" />
                      <span>CPU 占用</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeakMetric("mem")}
                      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                        peakMetric === "mem"
                          ? "bg-purple-500/15 text-purple-400 border border-purple-500/35 font-semibold shadow-xs"
                          : "bg-paper border border-rule text-ink-muted hover:text-ink hover:bg-paper-2"
                      }`}
                      title="点击聚焦内存并切换峰值展示"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#a855f7] shrink-0" />
                      <span>物理内存</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeakMetric("disk")}
                      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                        peakMetric === "disk"
                          ? "bg-zinc-500/15 text-zinc-100 border border-zinc-400/35 font-semibold shadow-xs"
                          : "bg-paper border border-rule text-ink-muted hover:text-ink hover:bg-paper-2"
                      }`}
                      title="点击聚焦磁盘并切换峰值展示"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#f3f4f6] shrink-0" />
                      <span>磁盘空间</span>
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted">
                    过去 {timeRangeLabels[timeRange]} 采样走势
                  </div>
                </div>

                {/* 3. 图表主体 (SVG) - 去面积化纯折线，高对比度 */}
                {loadData ? (
                  <div
                    className="w-full overflow-x-auto relative"
                    onMouseLeave={() => setLoadHoverIdx(null)}
                  >
                    <svg
                      ref={loadSvgRef}
                      viewBox={`0 0 ${chartWidth} ${loadChartHeight}`}
                      preserveAspectRatio="none"
                      className="w-full h-56 select-none cursor-crosshair block touch-none"
                      onMouseMove={handleLoadMouseMove}
                      onTouchStart={handleLoadTouchMove}
                      onTouchMove={handleLoadTouchMove}
                    >
                      {/* Horizontal Y-Gridlines (Contrast >= 3:1) */}
                      {loadYTicks.map((tick, i) => (
                        <g key={i}>
                          <line
                            x1={loadPadding.left}
                            y1={tick.y}
                            x2={chartWidth - loadPadding.right}
                            y2={tick.y}
                            stroke="currentColor"
                            className="text-white/10"
                            strokeWidth="0.75"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={loadPadding.left - 10}
                            y={tick.y + 3.5}
                            textAnchor="end"
                            className="fill-ink-secondary text-[10px] font-mono font-medium"
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
                        className="text-white/20"
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
                              className="text-white/20"
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
                              className="fill-ink-secondary text-[10px] font-mono font-medium"
                            >
                              {formatTimeTick(t)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Disk Line (Subtle dotted white hairline) */}
                      {(() => {
                        const pts = loadData.disk.map((val, i) => ({
                          x: getLoadX(i),
                          y: getLoadY(val),
                        }));
                        return (
                          <path
                            d={generatePath(pts, false)}
                            fill="none"
                            stroke="#f3f4f6"
                            strokeWidth="1.5"
                            strokeDasharray="2 3"
                            opacity="0.85"
                          />
                        );
                      })()}

                      {/* Memory Line (Distinct Electric Violet dashed line) */}
                      {(() => {
                        const pts = loadData.mem.map((val, i) => ({
                          x: getLoadX(i),
                          y: getLoadY(val),
                        }));
                        return (
                          <path
                            d={generatePath(pts, isSmooth)}
                            fill="none"
                            stroke="#a855f7"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="5 3"
                            opacity="0.95"
                          />
                        );
                      })()}

                      {/* CPU Line (Sharp Cyan solid line - no obscuring area fill) */}
                      {(() => {
                        const pts = loadData.cpu.map((val, i) => ({
                          x: getLoadX(i),
                          y: getLoadY(val),
                        }));
                        return (
                          <path
                            d={generatePath(pts, isSmooth)}
                            fill="none"
                            stroke="#00a2ff"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      })()}

                      {/* Dynamic Peak Marker Bead */}
                      {(() => {
                        const idx =
                          peakMetric === "cpu"
                            ? peakCpuIdx
                            : peakMetric === "mem"
                            ? peakMemIdx
                            : peakDiskIdx;
                        const val =
                          peakMetric === "cpu"
                            ? peakCpuVal
                            : peakMetric === "mem"
                            ? peakMemVal
                            : peakDiskVal;
                        const color =
                          peakMetric === "cpu"
                            ? "#00a2ff"
                            : peakMetric === "mem"
                            ? "#a855f7"
                            : "#f3f4f6";
                        const label =
                          peakMetric === "cpu"
                            ? "CPU"
                            : peakMetric === "mem"
                            ? "内存"
                            : "磁盘";
                        if (val <= 0) return null;
                        return (
                          <g className="pointer-events-none">
                            <circle
                              cx={getLoadX(idx)}
                              cy={getLoadY(val)}
                              r="4"
                              fill={color}
                              stroke="var(--color-paper-2)"
                              strokeWidth="2"
                            />
                            <text
                              x={getLoadX(idx)}
                              y={getLoadY(val) - 8}
                              textAnchor="middle"
                              fill={color}
                              className="text-[9px] font-mono font-bold"
                            >
                              {label} {val}%
                            </text>
                          </g>
                        );
                      })()}

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
                            fill="#00a2ff"
                            stroke="var(--color-paper-2)"
                            strokeWidth="2"
                          />
                          {/* Memory hover bead */}
                          <circle
                            cx={getLoadX(loadHoverIdx)}
                            cy={getLoadY(loadData.mem[loadHoverIdx])}
                            r="3.5"
                            fill="#a855f7"
                            stroke="var(--color-paper-2)"
                            strokeWidth="2"
                          />
                          {/* Disk hover bead */}
                          <circle
                            cx={getLoadX(loadHoverIdx)}
                            cy={getLoadY(loadData.disk[loadHoverIdx])}
                            r="3.5"
                            fill="#f3f4f6"
                            stroke="var(--color-paper-2)"
                            strokeWidth="2"
                          />
                        </g>
                      )}
                    </svg>

                    {/* Hover Floating Tooltip */}
                    {loadHoverIdx !== null && loadTimestamps[loadHoverIdx] && (
                      <div
                        className={`absolute top-2 z-30 p-3 rounded-xl bg-paper-2/95 border border-rule shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-150 pointer-events-none min-w-[185px] space-y-2 ${
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
                              <span className="w-2 h-2 rounded-full bg-[#00a2ff] shrink-0" />
                              <span>CPU 占用</span>
                            </span>
                            <span className="font-bold text-ink">
                              {loadData.cpu[loadHoverIdx]}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-purple-400">
                              <span className="w-2 h-2 rounded-full bg-[#a855f7] shrink-0" />
                              <span>物理内存</span>
                            </span>
                            <span className="font-bold text-ink">
                              {loadData.mem[loadHoverIdx]}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 text-zinc-300">
                              <span className="w-2 h-2 rounded-full bg-[#f3f4f6] shrink-0" />
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

                {/* Sub-track: Network Throughput Mirrored Butterfly Chart */}
                {loadData && loadData.netIn && (
                  <div className="mt-4 pt-4 border-t border-rule/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink font-sans">
                          网卡时序吞吐带宽 (镜像蝴蝶图)
                        </span>
                        <span className="text-[10px] font-mono text-ink-muted px-1.5 py-0.5 rounded-sm bg-paper-2 border border-rule">
                          峰值 {formatNetSpeed(maxNetBytes)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-ink-muted">
                        <span className="flex items-center gap-1 text-sky-400">
                          <span className="w-2 h-1 rounded-xs bg-[#06b6d4]" />
                          <span>▲ 上行 (Tx, 出站)</span>
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-2 h-1 rounded-xs bg-[#10b981]" />
                          <span>▼ 下行 (Rx, 入站)</span>
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
                        className="w-full h-36 select-none cursor-crosshair block touch-none"
                        onMouseMove={handleNetMouseMove}
                        onTouchStart={handleNetTouchMove}
                        onTouchMove={handleNetTouchMove}
                      >
                        <defs>
                          {/* Butterfly Tx Gradient: radiates upwards from Center 0 (100% -> 0%) */}
                          <linearGradient id="butterfly-tx-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.02" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.22" />
                          </linearGradient>
                          {/* Butterfly Rx Gradient: radiates downwards from Center 0 (0% -> 100%) */}
                          <linearGradient id="butterfly-rx-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>

                        {/* Top Y-Gridline (Tx peak) */}
                        <line
                          x1={netPadding.left}
                          y1={netPadding.top}
                          x2={chartWidth - netPadding.right}
                          y2={netPadding.top}
                          stroke="currentColor"
                          className="text-white/10"
                          strokeWidth="0.65"
                          strokeDasharray="2 4"
                        />

                        {/* Center Baseline (Zero Axis) */}
                        <line
                          x1={netPadding.left}
                          y1={netCenterY}
                          x2={chartWidth - netPadding.right}
                          y2={netCenterY}
                          stroke="currentColor"
                          className="text-white/30"
                          strokeWidth="1"
                        />

                        {/* Bottom Y-Gridline (Rx peak) */}
                        <line
                          x1={netPadding.left}
                          y1={netPadding.top + netInnerHeight}
                          x2={chartWidth - netPadding.right}
                          y2={netPadding.top + netInnerHeight}
                          stroke="currentColor"
                          className="text-white/10"
                          strokeWidth="0.65"
                          strokeDasharray="2 4"
                        />

                        {/* NetOut (Tx 上行) Butterfly Area & Line (Growing Upwards) */}
                        {(() => {
                          const pts = loadData.netOut.map((bytes, i) => ({
                            x: getLoadX(i),
                            y: getNetTxY(bytes),
                          }));
                          return (
                            <>
                              <path
                                d={generateAreaPath(pts, netCenterY, isSmooth)}
                                fill="url(#butterfly-tx-grad)"
                                className="pointer-events-none"
                              />
                              <path
                                d={generatePath(pts, isSmooth)}
                                fill="none"
                                stroke="#06b6d4"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </>
                          );
                        })()}

                        {/* NetIn (Rx 下行) Butterfly Area & Line (Growing Downwards) */}
                        {(() => {
                          const pts = loadData.netIn.map((bytes, i) => ({
                            x: getLoadX(i),
                            y: getNetRxY(bytes),
                          }));
                          return (
                            <>
                              <path
                                d={generateAreaPath(pts, netCenterY, isSmooth)}
                                fill="url(#butterfly-rx-grad)"
                                className="pointer-events-none"
                              />
                              <path
                                d={generatePath(pts, isSmooth)}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </>
                          );
                        })()}

                        {/* Y-axis High Contrast Monospace Labels (Concise, Prevents Boundary Clipping) */}
                        <text
                          x={netPadding.left - 12}
                          y={netPadding.top + 8}
                          textAnchor="end"
                          className="fill-sky-400 text-[10px] font-mono font-bold"
                        >
                          ▲ Tx
                        </text>
                        <text
                          x={netPadding.left - 12}
                          y={netCenterY + 3.5}
                          textAnchor="end"
                          className="fill-ink-secondary text-[10px] font-mono font-bold"
                        >
                          0
                        </text>
                        <text
                          x={netPadding.left - 12}
                          y={netPadding.top + netInnerHeight - 4}
                          textAnchor="end"
                          className="fill-emerald-400 text-[10px] font-mono font-bold"
                        >
                          ▼ Rx
                        </text>

                        {/* Interactive Crosshair & Cursor */}
                        {netHoverIdx !== null && netHoverIdx >= 0 && (
                          <g className="pointer-events-none">
                            <line
                              x1={getLoadX(netHoverIdx)}
                              y1={netPadding.top}
                              x2={getLoadX(netHoverIdx)}
                              y2={netPadding.top + netInnerHeight}
                              stroke="currentColor"
                              className="text-accent/80"
                              strokeWidth="1"
                              strokeDasharray="2 3"
                            />
                            {/* Uplink bead (Tx, Upper) */}
                            <circle
                              cx={getLoadX(netHoverIdx)}
                              cy={getNetTxY(loadData.netOut[netHoverIdx])}
                              r="4"
                              fill="#06b6d4"
                              stroke="var(--color-paper-2)"
                              strokeWidth="2"
                            />
                            {/* Downlink bead (Rx, Lower) */}
                            <circle
                              cx={getLoadX(netHoverIdx)}
                              cy={getNetRxY(loadData.netIn[netHoverIdx])}
                              r="4"
                              fill="#10b981"
                              stroke="var(--color-paper-2)"
                              strokeWidth="2"
                            />
                          </g>
                        )}
                      </svg>

                      {/* Net Hover Floating Tooltip with Traffic Profile */}
                      {netHoverIdx !== null && loadTimestamps[netHoverIdx] && (() => {
                        const rx = loadData.netIn[netHoverIdx] || 0;
                        const tx = loadData.netOut[netHoverIdx] || 0;
                        const total = rx + tx;
                        const isTxDominant = tx > rx * 1.3 && tx > 10240;
                        const isRxDominant = rx > tx * 1.3 && rx > 10240;

                        return (
                          <div
                            className={`absolute top-2 z-30 p-2.5 rounded-xl bg-paper-2/95 border border-rule shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-150 pointer-events-none min-w-[195px] space-y-1.5 ${
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
                                <span className="flex items-center gap-1.5 text-sky-400">
                                  <span className="w-2 h-2 rounded-full bg-[#06b6d4] shrink-0" />
                                  <span>▲ 上行 (Tx)</span>
                                </span>
                                <span className="font-bold text-ink">
                                  {formatNetSpeed(tx)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1.5 text-emerald-400">
                                  <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
                                  <span>▼ 下行 (Rx)</span>
                                </span>
                                <span className="font-bold text-ink">
                                  {formatNetSpeed(rx)}
                                </span>
                              </div>
                              <div className="pt-1 border-t border-rule/50 flex items-center justify-between text-[10px] text-ink-muted">
                                <span>吞吐特征:</span>
                                <span
                                  className={`font-semibold ${
                                    isTxDominant
                                      ? "text-sky-400"
                                      : isRxDominant
                                      ? "text-emerald-400"
                                      : "text-ink-secondary"
                                  }`}
                                >
                                  {isTxDominant
                                    ? `出站密集型 (${Math.round((tx / (total || 1)) * 100)}%)`
                                    : isRxDominant
                                    ? `入站密集型 (${Math.round((rx / (total || 1)) * 100)}%)`
                                    : "双向均衡"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
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
                  <div className="text-[10px] font-mono text-[#7a7a7a] tracking-wider uppercase font-medium">
                    LINUX KERNEL SYSSTAT · /PROC/STAT & /PROC/MEMINFO · 10S POLLING
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
