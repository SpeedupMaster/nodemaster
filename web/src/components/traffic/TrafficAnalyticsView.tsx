import React, { useState, useEffect, useMemo } from "react";
import {
  ChartBar,
  ChartPieSlice,
  HardDrives,
  DownloadSimple,
  ArrowClockwise,
  MagnifyingGlass,
  ArrowDown,
  ArrowUp,
  Lightning,
  Funnel,
  ShieldCheck,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  TrafficAnalyticsSummary,
  ServiceTrafficItem,
  TrafficCategory,
  TrafficTimeSeriesPoint,
  NodeItem,
} from "../../types";
import { Tooltip } from "../common/Tooltip";
import { Input } from "../common/Input";
import {
  renderOfficialServiceLogo,
  YoutubeOfficialLogo,
  OpenAiOfficialLogo,
} from "./BrandIcons";

interface TrafficAnalyticsViewProps {
  nodes: NodeItem[];
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

// 格式化 Y 轴刻度易读规范数字 (Nice Numbers)
const formatTickBytes = (bytes: number): string => {
  if (bytes <= 0) return "0";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1);
  return `${formatted} ${sizes[i]}`;
};

// Nice Numbers 规整阶梯算法
const getNiceYAxis = (maxValue: number): { niceMax: number; niceTicks: number[] } => {
  if (maxValue <= 0) {
    const defaultMax = 1024 * 1024 * 1024;
    return { niceMax: defaultMax, niceTicks: [defaultMax, defaultMax * 0.5, 0] };
  }
  const k = 1024;
  const exp = Math.min(4, Math.floor(Math.log(maxValue) / Math.log(k)));
  const unit = Math.pow(k, exp);
  const valInUnit = maxValue / unit;

  const steps = [
    0.5, 1, 2, 4, 6, 8, 10, 12, 16, 20, 25, 30, 40, 50, 60, 80, 100, 
    120, 160, 200, 250, 300, 400, 500, 600, 800, 1000,
  ];
  const chosenInUnit = steps.find((s) => s >= valInUnit) || Math.ceil(valInUnit);
  const niceMax = chosenInUnit * unit;
  return {
    niceMax,
    niceTicks: [niceMax, niceMax * 0.5, 0],
  };
};

export const TrafficAnalyticsView: React.FC<TrafficAnalyticsViewProps> = ({ nodes }) => {
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d" | "month" | "all">("today");
  const [data, setData] = useState<TrafficAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [chartMode, setChartMode] = useState<"stacked" | "total">("stacked");
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [hoveredLegendKey, setHoveredLegendKey] = useState<string | null>(null);

  // 动态图例过滤切换 (至少保留 1 个可见分类)
  const toggleCategory = (catKey: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catKey)) {
        next.delete(catKey);
      } else {
        const allKeys = ["streaming", "ai", "social", "developer"];
        const remaining = allKeys.filter((k) => !next.has(k) && k !== catKey);
        if (remaining.length > 0) {
          next.add(catKey);
        }
      }
      return next;
    });
  };

  const fetchAnalytics = async (range = timeRange) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/traffic/analytics?range=${range}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch traffic analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [timeRange]);

  const handleExport = () => {
    window.open(`/api/traffic/export?range=${timeRange}`, "_blank");
  };

  // Filtered services
  const filteredServices = useMemo(() => {
    if (!data) return [];
    return data.services.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.domains.some((d) => d.toLowerCase().includes(search.toLowerCase()));
      const matchesCat = selectedCategory === "all" || s.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [data, search, selectedCategory]);

  const topService = data?.services[0];
  const aiTraffic = useMemo(() => {
    if (!data) return 0;
    return data.services
      .filter((s) => s.category === "ai")
      .reduce((acc, s) => acc + s.totalBytes, 0);
  }, [data]);

  const aiPercentage = data?.totalRecordedBytes
    ? +((aiTraffic / data.totalRecordedBytes) * 100).toFixed(1)
    : 0;

  // 动态计算当前柱体激活分类的总流量 (响应图例过滤)
  const getPointActiveBytes = (p: TrafficTimeSeriesPoint) => {
    let sum = 0;
    if (!hiddenCategories.has("streaming")) sum += p.streamingBytes;
    if (!hiddenCategories.has("ai")) sum += p.aiBytes;
    if (!hiddenCategories.has("social")) sum += p.socialBytes;
    if (!hiddenCategories.has("developer")) sum += p.devBytes;
    return sum;
  };

  // Y 轴规范化整洁刻度计算 (Nice Numbers)
  const { niceMax, niceTicks } = useMemo(() => {
    if (!data || !data.timeSeries.length) {
      const def = 1024 * 1024 * 1024;
      return { niceMax: def, niceTicks: [def, def * 0.5, 0] };
    }
    const rawMax = Math.max(...data.timeSeries.map((p) => getPointActiveBytes(p)));
    return getNiceYAxis(rawMax);
  }, [data, hiddenCategories]);

  // 识别全局流量峰值时段 (用于平滑面积趋势图的峰值数据圆点高亮与数值标注)
  const { peakIdx, peakBytes } = useMemo(() => {
    if (!data || !data.timeSeries.length) return { peakIdx: -1, peakBytes: 0 };
    let maxVal = -1;
    let maxIdx = -1;
    data.timeSeries.forEach((p, i) => {
      const val = getPointActiveBytes(p);
      if (val > maxVal) {
        maxVal = val;
        maxIdx = i;
      }
    });
    return { peakIdx: maxIdx, peakBytes: maxVal };
  }, [data, hiddenCategories]);

  // 构建平滑面积趋势图路径 (Cubic Bezier Spline 拟合曲线与渐变区域)
  const { areaPathD, linePathD } = useMemo(() => {
    if (!data || !data.timeSeries.length) return { areaPathD: "", linePathD: "" };
    const n = data.timeSeries.length;
    const pts: { x: number; y: number }[] = [];

    // 首端锚点 (向左平滑过渡至 x = 0 边缘)
    const firstVal = getPointActiveBytes(data.timeSeries[0]);
    const firstY = Math.max(2, Math.min(100, 100 - (firstVal / niceMax) * 100));
    pts.push({ x: 0, y: firstY });

    // 各时序柱中心点坐标 (以 1000x100 坐标系自适应映射)
    data.timeSeries.forEach((p, i) => {
      const val = getPointActiveBytes(p);
      const x = ((i + 0.5) / n) * 1000;
      const y = Math.max(2, Math.min(100, 100 - (val / niceMax) * 100));
      pts.push({ x, y });
    });

    // 末端锚点 (向右平滑过渡至 x = 1000 边缘)
    const lastVal = getPointActiveBytes(data.timeSeries[n - 1]);
    const lastY = Math.max(2, Math.min(100, 100 - (lastVal / niceMax) * 100));
    pts.push({ x: 1000, y: lastY });

    // Catmull-Rom 三次贝塞尔曲线控制点生成
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const areaD = `${d} L 1000 100 L 0 100 Z`;
    return { areaPathD: areaD, linePathD: d };
  }, [data, hiddenCategories, niceMax]);

  return (
    <div className="space-y-6">
      {/* 头部导航与操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-xl font-bold text-ink tracking-tight">业务流量统计与服务分析</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-medium bg-accent/15 text-accent border border-accent/25 shrink-0">
              <Lightning className="w-3 h-3" />
              时序洞悉
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5 hidden sm:block">
            实时统计各应用服务流量消耗、分流命中走向及全网 VPS 节点分流承载矩阵
          </p>
        </div>

        {/* 时间跨度切换 & 操作按钮 */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <div className="flex items-center bg-paper-2 border border-rule rounded-lg p-0.5 text-xs font-medium overflow-x-auto no-scrollbar flex-1 sm:flex-initial">
            {[
              { id: "today", label: "今日 (24h)", short: "今日" },
              { id: "7d", label: "近 7 天", short: "7天" },
              { id: "30d", label: "近 30 天", short: "30天" },
              { id: "month", label: "本月计费期", short: "本月" },
              { id: "all", label: "全部累计", short: "全部" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id as any)}
                className={`px-2 sm:px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 text-center ${
                  timeRange === t.id
                    ? "bg-paper-3 text-accent font-semibold shadow-xs"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => fetchAnalytics()}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-paper-2 hover:bg-paper-hover text-ink-secondary hover:text-ink text-xs font-medium border border-rule transition-colors cursor-pointer touch-manipulation min-h-[30px]"
              title="刷新统计数据"
            >
              <ArrowClockwise className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent" : ""}`} />
              <span className="hidden sm:inline">刷新</span>
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-paper-2 hover:bg-paper-hover text-ink-secondary hover:text-ink text-xs font-medium border border-rule transition-colors cursor-pointer touch-manipulation min-h-[30px]"
              title="导出 JSON 流量报告"
            >
              <DownloadSimple className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">导出</span>
            </button>
          </div>
        </div>
      </div>

      {/* 顶部 4 大核心指标看板 (移动端 2x2 规整布局) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 卡片 1: 监测总流量 */}
        <div className="p-3 sm:p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-medium text-ink-secondary truncate">监测总流量消耗</span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                <ChartBar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-lg sm:text-2xl font-bold font-mono text-ink tracking-tight truncate block">
                {data ? formatBytes(data.totalRecordedBytes) : "--"}
              </span>
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-mono text-ink-muted flex-wrap">
            <span className="flex items-center gap-0.5 text-sky-400">
              <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              {data ? formatBytes(data.totalDownlinkBytes) : "--"}
            </span>
            <span className="opacity-40">•</span>
            <span className="flex items-center gap-0.5 text-purple-400">
              <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              {data ? formatBytes(data.totalUplinkBytes) : "--"}
            </span>
          </div>
        </div>

        {/* 卡片 2: Top 1 霸榜服务 */}
        <div className="p-3 sm:p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-medium text-ink-secondary truncate">流量霸榜服务</span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <YoutubeOfficialLogo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 truncate">
              <span className="text-base sm:text-2xl font-bold font-mono text-ink tracking-tight truncate">
                {topService ? topService.name : "--"}
              </span>
              {topService && (
                <span className="text-[10px] sm:text-xs font-mono font-semibold text-rose-400 shrink-0">
                  {topService.percentage}%
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 text-[10px] sm:text-[11px] font-mono text-ink-muted truncate">
            <span>消耗: </span>
            <span className="font-semibold text-ink">
              {topService ? formatBytes(topService.totalBytes) : "--"}
            </span>
          </div>
        </div>

        {/* 卡片 3: AI 办公智能流量 */}
        <div className="p-3 sm:p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-medium text-ink-secondary truncate">AI 智能消耗</span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <OpenAiOfficialLogo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 truncate">
              <span className="text-lg sm:text-2xl font-bold font-mono text-emerald-400 tracking-tight truncate">
                {formatBytes(aiTraffic)}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-semibold text-ink-muted shrink-0">
                ({aiPercentage}%)
              </span>
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 text-[10px] sm:text-[11px] font-mono text-ink-muted flex items-center gap-1 truncate">
            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">落地住宅机分流</span>
          </div>
        </div>

        {/* 卡片 4: 业务调度请求数 & 实时流 */}
        <div className="p-3 sm:p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-medium text-ink-secondary truncate">调度请求 / 活跃流</span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <HardDrives className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1 truncate">
              <span className="text-lg sm:text-2xl font-bold font-mono text-ink tracking-tight truncate">
                {data ? data.totalRequests.toLocaleString() : "--"}
              </span>
              <span className="text-[10px] sm:text-xs font-mono text-ink-muted shrink-0">次</span>
            </div>
          </div>
          <div className="mt-2 sm:mt-2.5 text-[10px] sm:text-[11px] font-mono text-ink-muted flex items-center gap-1 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-accent font-semibold font-mono">{data?.activeStreams || 0}</span>
            <span>个活跃连接</span>
          </div>
        </div>
      </div>

      {/* 中部图表分析区域：时序流量趋势 + 业务类别分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 左侧 2/3: 时序流量趋势柱状堆叠图 */}
        <div className="lg:col-span-2 p-3.5 sm:p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-ink flex items-center gap-2">
                <ChartBar className="w-4 h-4 text-accent shrink-0" />
                <span>{chartMode === "total" ? "流量总量时序走势" : "流量时序分布图"} ({timeRange === "today" ? "24 小时" : timeRange === "7d" ? "近 7 天" : "周期分布"})</span>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-ink-muted mt-0.5">
                {timeRange === "today" ? (
                  <span>
                    高峰时段 <span className="text-accent font-medium font-mono">20:00 - 23:00</span> · <span className="hidden sm:inline">{chartMode === "total" ? "鼠标悬停曲线查看时序流量总量与切片" : "鼠标悬停柱体查看分类切片与构成明细"}</span><span className="sm:hidden">点击柱体查看明细</span>
                  </span>
                ) : (
                  <span>
                    <span className="hidden sm:inline">{chartMode === "total" ? "鼠标悬停曲线查看对应时间切片的总量走势" : "鼠标悬停柱状图查看对应时间切片的分类流量构成"}</span>
                    <span className="sm:hidden">点击柱体查看明细</span>
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1 bg-paper-3 border border-rule rounded-md p-0.5 text-[11px] self-start sm:self-auto shrink-0">
              <button
                onClick={() => setChartMode("stacked")}
                className={`px-2.5 py-1 sm:py-0.5 rounded transition-colors cursor-pointer touch-manipulation min-h-[26px] sm:min-h-0 flex items-center ${
                  chartMode === "stacked" ? "bg-accent/20 text-accent font-semibold" : "text-ink-muted hover:text-ink"
                }`}
                title="各业务分类堆叠展示"
              >
                分类堆叠
              </button>
              <button
                onClick={() => setChartMode("total")}
                className={`px-2.5 py-1 sm:py-0.5 rounded transition-colors cursor-pointer touch-manipulation min-h-[26px] sm:min-h-0 flex items-center ${
                  chartMode === "total" ? "bg-accent/20 text-accent font-semibold" : "text-ink-muted hover:text-ink"
                }`}
                title="按时序流量展示平滑面积总量走势"
              >
                总量趋势
              </button>
            </div>
          </div>

          {/* 交互图表容器：左侧 Y 轴规整刻度 + 右侧主图表与 X 轴 (底部留白设定为 mb-6，为 X 轴文本预留 18px 呼吸间距) */}
          <div className="relative flex items-stretch pt-1 mb-6 select-none">
            {/* Y 轴刻度指示列 (左侧独立列，与绘图区等高) */}
            <div className="w-12 sm:w-14 shrink-0 flex flex-col justify-between text-right text-[10px] font-mono text-ink-muted/70 pr-2.5 pb-0 pt-0 select-none">
              <span className="leading-none">{formatTickBytes(niceTicks[0])}</span>
              <span className="leading-none">{formatTickBytes(niceTicks[1])}</span>
              <span className="leading-none text-ink-muted/40">0</span>
            </div>

            {/* 主图表与 X 轴绘图区 */}
            <div className="flex-1 min-w-0 relative">
              {/* 柱体与网格线主高度容器 (h-56，垂直展示空间扩大 32px，最大化数据墨水比) */}
              <div className="h-56 relative flex items-end border-b border-rule">
                {/* 背景横向辅助网格线 (极简降噪：稀疏虚线 stroke-dasharray: 2 4，超低对比度，把视觉焦点彻底还给数据柱) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none">
                  <line x1="0" y1="0.5" x2="100%" y2="0.5" stroke="currentColor" className="text-white/[0.06]" strokeDasharray="2 4" strokeWidth="1" />
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" className="text-white/[0.04]" strokeDasharray="2 4" strokeWidth="1" />
                </svg>

                {/* 总量趋势模式：平滑面积折线图 (Smooth Area Chart with Gradient) */}
                {chartMode === "total" && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
                    viewBox="0 0 1000 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="areaTrafficGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
                        <stop offset="65%" stopColor="#3b82f6" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>
                    <path d={areaPathD} fill="url(#areaTrafficGrad)" />
                    <path
                      d={linePathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                      className="transition-all duration-300"
                    />
                  </svg>
                )}

                {/* 总量趋势模式：全局流量峰值圆点高亮与数值标注 (Peak Indicator) */}
                {chartMode === "total" && peakIdx >= 0 && data && (
                  <div
                    className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center transition-all duration-300"
                    style={{
                      left: `${((peakIdx + 0.5) / data.timeSeries.length) * 100}%`,
                      top: `${Math.max(4, 100 - (peakBytes / niceMax) * 100)}%`,
                    }}
                  >
                    <span className="w-4 h-4 rounded-full bg-blue-500/25 animate-ping absolute" />
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-paper-2 shadow-md relative" />
                    <div className="absolute bottom-[calc(100%+6px)] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-[9px] font-mono text-blue-400 font-semibold whitespace-nowrap shadow-xs">
                      峰值 {formatBytes(peakBytes)}
                    </div>
                  </div>
                )}

                {/* 总量趋势模式：Hover 实时数据点 (Active Hover Symbol on Curve) */}
                {chartMode === "total" && hoveredPointIdx !== null && data && hoveredPointIdx !== peakIdx && (
                  <div
                    className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center transition-all duration-150"
                    style={{
                      left: `${((hoveredPointIdx + 0.5) / data.timeSeries.length) * 100}%`,
                      top: `${Math.max(4, 100 - (getPointActiveBytes(data.timeSeries[hoveredPointIdx]) / niceMax) * 100)}%`,
                    }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-400/20 absolute" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 shadow-md relative" />
                  </div>
                )}

                {/* 20:00 - 23:00 高峰时段背景高亮遮罩 (Mark Area：沉底垂直背景带，Fill: #FFFFFF 4%，去除多余线框噪点) */}
                {timeRange === "today" && data && data.timeSeries.length === 24 && (
                  <div
                    className="absolute inset-y-0 pointer-events-none z-0 bg-white/[0.04] flex flex-col justify-start items-center"
                    style={{
                      left: `${(20 / 24) * 100}%`,
                      width: `${(4 / 24) * 100}%`,
                    }}
                  >
                    <div className="mt-1.5 px-2 py-0.5 rounded-full bg-accent/15 text-[9px] font-mono font-medium text-accent flex items-center gap-1 shadow-2xs whitespace-nowrap">
                      <Lightning className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">高峰 20-23h</span>
                      <span className="sm:hidden">高峰</span>
                    </div>
                  </div>
                )}

                {/* 柱体列表 */}
                <div className="relative z-10 w-full h-full flex items-end gap-1 sm:gap-1.5 px-0.5">
                  {data?.timeSeries.map((p, idx) => {
                    const activeTotal = getPointActiveBytes(p);
                    const heightPct = Math.max(4, (activeTotal / niceMax) * 100);
                    const isHovered = hoveredPointIdx === idx;
                    const isAnyHovered = hoveredPointIdx !== null;
                    const isTick =
                      timeRange === "today"
                        ? idx % 3 === 0
                        : timeRange === "7d"
                        ? true
                        : idx % 5 === 0 || idx === data.timeSeries.length - 1;

                    // Tooltip 降序排序切片数据 (未隐藏分类均展示，即使为 0 保持结构整齐一致)
                    const breakdown = [
                      { key: "streaming", label: "流媒体", bytes: p.streamingBytes, textClass: "text-blue-400", dotClass: "bg-blue-500", isHidden: hiddenCategories.has("streaming") },
                      { key: "ai", label: "AI 智能", bytes: p.aiBytes, textClass: "text-teal-400", dotClass: "bg-teal-500", isHidden: hiddenCategories.has("ai") },
                      { key: "social", label: "社交通讯", bytes: p.socialBytes, textClass: "text-amber-400", dotClass: "bg-amber-500", isHidden: hiddenCategories.has("social") },
                      { key: "developer", label: "开发托管", bytes: p.devBytes, textClass: "text-purple-400", dotClass: "bg-purple-500", isHidden: hiddenCategories.has("developer") },
                    ]
                      .filter((item) => !item.isHidden)
                      .sort((a, b) => b.bytes - a.bytes);

                    // 确定 Tooltip 对齐方式避免两端溢出
                    const tooltipAlignClass =
                      idx <= 2
                        ? "left-0"
                        : idx >= data.timeSeries.length - 3
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2";

                    // 时间区间文案 (如 20:00 - 21:00)
                    const timeSlotTitle = (() => {
                      if (timeRange === "today" && p.time.includes(":")) {
                        const h = parseInt(p.time.split(":")[0], 10);
                        const nextH = (h + 1) % 24;
                        return `${p.time} - ${String(nextH).padStart(2, "0")}:00`;
                      }
                      return p.time;
                    })();

                    return (
                      <div
                        key={`${p.time}-${idx}`}
                        className="flex-1 h-full flex flex-col justify-end items-center relative group cursor-pointer z-10"
                        onMouseEnter={() => setHoveredPointIdx(idx)}
                        onMouseLeave={() => setHoveredPointIdx(null)}
                      >
                        {/* Crosshair 十字准星纵向辅助线 */}
                        {isHovered && (
                          <div className="absolute inset-y-0 w-full bg-accent/[0.06] border-x border-accent/25 pointer-events-none -z-10 rounded-xs" />
                        )}

                        {/* Tooltip 浮动卡片 */}
                        {isHovered && (
                          <div
                            className={`absolute bottom-[calc(100%+8px)] z-30 p-2.5 rounded-lg bg-paper-3/95 backdrop-blur-sm border border-rule shadow-xl text-xs font-mono space-y-1.5 pointer-events-none min-w-[190px] ${tooltipAlignClass}`}
                          >
                            <div className="font-semibold text-ink border-b border-rule-subtle pb-1 flex items-center justify-between gap-3">
                              <span className="font-sans text-[11px] text-ink-muted">{timeSlotTitle}</span>
                              <span className="text-accent font-bold">{formatBytes(activeTotal)}</span>
                            </div>
                            <div className="space-y-1 pt-0.5">
                              {breakdown.length > 0 ? (
                                breakdown.map((item) => {
                                  const pct = activeTotal > 0 ? Math.round((item.bytes / activeTotal) * 100) : 0;
                                  return (
                                    <div key={item.key} className={`flex items-center justify-between text-[11px] ${item.textClass}`}>
                                      <span className="flex items-center gap-1.5 font-sans">
                                        <span className={`w-2 h-2 rounded-xs ${item.dotClass} inline-block shrink-0`} />
                                        <span>{item.label}:</span>
                                      </span>
                                      <span className="font-mono">
                                        {formatBytes(item.bytes)} ({pct}%)
                                      </span>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-[11px] text-ink-muted">当前分类已隐藏</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 柱体主体：仅在堆叠模式下渲染堆叠柱，总量模式下由平滑面积图展现 */}
                        {chartMode === "stacked" && (
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-2.5 sm:w-3.5 rounded-t-xs overflow-hidden flex flex-col justify-end divide-y divide-paper-2 border-t border-x border-white/10 shrink-0 transition-all duration-200 ${
                              isHovered
                                ? "brightness-110 ring-2 ring-accent/80 z-20"
                                : isAnyHovered
                                ? "opacity-35"
                                : "opacity-95"
                            }`}
                          >
                            {!hiddenCategories.has("developer") && p.devBytes > 0 && (
                              <div style={{ flex: `${p.devBytes} 1 0px` }} className="bg-purple-500 w-full min-h-[1.5px]" />
                            )}
                            {!hiddenCategories.has("social") && p.socialBytes > 0 && (
                              <div style={{ flex: `${p.socialBytes} 1 0px` }} className="bg-amber-500 w-full min-h-[1.5px]" />
                            )}
                            {!hiddenCategories.has("ai") && p.aiBytes > 0 && (
                              <div style={{ flex: `${p.aiBytes} 1 0px` }} className="bg-teal-500 w-full min-h-[1.5px]" />
                            )}
                            {!hiddenCategories.has("streaming") && p.streamingBytes > 0 && (
                              <div style={{ flex: `${p.streamingBytes} 1 0px` }} className="bg-blue-500 w-full min-h-[1.5px]" />
                            )}
                          </div>
                        )}

                        {/* X 轴刻度指示与正下方居中文本 (严格 8-pt 栅格：4px 刻度线 + 8px 空白，距离基线 12px) */}
                        {isTick ? (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none pt-0">
                            <div className="w-[1.5px] h-1 bg-rule-active mb-2" />
                            <span className="text-[10px] font-mono text-ink-muted whitespace-nowrap text-center leading-none">
                              {p.time}
                            </span>
                          </div>
                        ) : (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none pt-0">
                            <div className="w-[1px] h-1 bg-rule/50 mb-2" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 图例 (Legend) - 水平居中平衡构图，消除左右失衡与多余留白 */}
          <div className="flex items-center justify-center pt-3 border-t border-rule/20 select-none">
            <div className="flex items-center justify-center gap-6 sm:gap-8 flex-wrap text-xs font-mono">
              {[
                { key: "streaming", label: "流媒体", color: "bg-blue-500" },
                { key: "ai", label: "AI 智能", color: "bg-teal-500" },
                { key: "social", label: "社交通讯", color: "bg-amber-500" },
                { key: "developer", label: "开发托管", color: "bg-purple-500" },
              ].map((item) => {
                const isHidden = hiddenCategories.has(item.key);
                const isLegendHovered = hoveredLegendKey === item.key;
                const isAnyLegendHovered = hoveredLegendKey !== null;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleCategory(item.key)}
                    onMouseEnter={() => setHoveredLegendKey(item.key)}
                    onMouseLeave={() => setHoveredLegendKey(null)}
                    className={`flex items-center gap-2 transition-all cursor-pointer select-none group py-0.5 ${
                      isHidden
                        ? "opacity-30 text-ink-muted line-through hover:opacity-60"
                        : isAnyLegendHovered && !isLegendHovered
                        ? "opacity-40 text-ink-secondary"
                        : "opacity-100 text-ink-secondary hover:text-ink"
                    }`}
                    title={isHidden ? `点击恢复显示 ${item.label}` : `点击隐藏 ${item.label}`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-xs transition-transform group-hover:scale-110 shrink-0 ${
                        isHidden ? "bg-ink-muted/40" : item.color
                      }`}
                    />
                    <span className="font-sans text-xs font-medium tracking-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右侧 1/3: 类别占比环形 / 比例列表 */}
        <div className="p-3.5 sm:p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <ChartPieSlice className="w-4 h-4 text-accent" />
              服务类别分布占比
            </h3>
            <span className="text-[11px] text-ink-muted font-mono">
              共 {data?.categories.length || 0} 个类别
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {data?.categories.map((cat) => (
              <div key={cat.category} className="space-y-1 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink font-sans flex items-center gap-1.5 font-medium">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.categoryName}
                  </span>
                  <div className="flex items-center gap-2 text-ink-muted">
                    <span className="font-semibold text-ink">{formatBytes(cat.totalBytes)}</span>
                    <span className="text-accent font-semibold">{cat.percentage}%</span>
                  </div>
                </div>

                {/* 进度条 */}
                <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-lg bg-paper-3/60 border border-rule-subtle text-[11px] text-ink-muted">
            💡 提示：流媒体与 AI 应用占据了绝大部分出站带宽，建议主力直连机搭配住宅解锁机分流组合。
          </div>
        </div>
      </div>

      {/* 下部核心表格：各应用服务流量消耗排行明细 */}
      <div className="rounded-xl border border-rule bg-paper-2 overflow-hidden shadow-xs space-y-0">
        {/* 表头筛选与搜索栏 */}
        <div className="p-3.5 sm:p-4 border-b border-rule flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 bg-paper-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-ink">服务流量消耗明细</span>
            <span className="text-[11px] sm:text-xs text-ink-muted font-mono">
              ({filteredServices.length} 个服务)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full md:w-auto">
            {/* 分类筛选胶囊 */}
            <div className="flex items-center gap-1 bg-paper-3 p-0.5 rounded-lg border border-rule text-xs overflow-x-auto no-scrollbar flex-1 md:flex-initial">
              {[
                { id: "all", label: "全部" },
                { id: "streaming", label: "流媒体" },
                { id: "ai", label: "AI应用" },
                { id: "social", label: "社交通讯" },
                { id: "developer", label: "代码开发" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                    selectedCategory === c.id
                      ? "bg-accent/20 text-accent font-semibold"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* 搜索框 */}
            <div className="w-full md:w-56 shrink-0">
              <Input
                prefixIcon={<MagnifyingGlass className="w-3.5 h-3.5" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索服务应用名称..."
              />
            </div>
          </div>
        </div>

        {/* 移动端卡片式流式列表 (md:hidden) */}
        <div className="md:hidden divide-y divide-rule/50">
          {filteredServices.map((service, idx) => (
            <div key={service.id} className="p-3.5 space-y-2.5 bg-paper-2 hover:bg-paper-hover/50 transition-colors">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-rule shadow-xs"
                    style={{ backgroundColor: `${service.color}15` }}
                  >
                    {renderOfficialServiceLogo(service.icon, service.id, service.color, "w-4 h-4")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs text-ink truncate">
                        {service.name}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-medium border whitespace-nowrap shrink-0 leading-none"
                        style={{
                          backgroundColor: `${service.color}15`,
                          borderColor: `${service.color}35`,
                          color: service.color,
                        }}
                      >
                        {service.categoryName}
                      </span>
                    </div>
                    <div className="text-[10px] text-ink-muted font-mono mt-0.5 flex items-center gap-1">
                      <span className="font-semibold text-ink-secondary">#{idx + 1}</span>
                      <span>•</span>
                      <span>{service.activeConnections} 活跃连接</span>
                    </div>
                  </div>
                </div>

                {/* 右侧数值：总消耗与占比 */}
                <div className="text-right shrink-0">
                  <div className="font-bold text-xs font-mono text-ink">
                    {formatBytes(service.totalBytes)}
                  </div>
                  <div className="text-[10px] font-mono font-semibold text-accent mt-0.5">
                    {service.percentage}%
                  </div>
                </div>
              </div>

              {/* 进度条 */}
              <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, service.percentage * 3.5)}%`,
                    backgroundColor: service.color,
                  }}
                />
              </div>

              {/* 下行 / 上行与请求数 */}
              <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-ink-secondary">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-0.5 text-sky-400">
                    <ArrowDown className="w-2.5 h-2.5" />
                    <span>{formatBytes(service.downlinkBytes)}</span>
                  </span>
                  <span className="flex items-center gap-0.5 text-purple-400">
                    <ArrowUp className="w-2.5 h-2.5" />
                    <span>{formatBytes(service.uplinkBytes)}</span>
                  </span>
                </div>
                <span className="text-ink-muted">
                  {service.requestsCount.toLocaleString()} 次请求
                </span>
              </div>

              {/* 承载节点分布 (移动端紧凑徽章) */}
              {service.nodeDistribution.some((n) => n.percentage > 0) && (
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  <span className="text-[9px] text-ink-muted font-mono shrink-0">承载:</span>
                  {service.nodeDistribution
                    .filter((n) => n.percentage > 0)
                    .slice(0, 3)
                    .map((nd) => (
                      <span
                        key={nd.nodeId}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-paper-3 border border-rule text-ink-secondary"
                      >
                        <span className="truncate max-w-[90px]">{nd.nodeName}</span>
                        <span className="text-accent font-semibold">{nd.percentage}%</span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 桌面端完整明细表格 (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-rule bg-paper/60 text-[11px] font-mono text-ink-muted uppercase select-none">
                <th className="py-3 px-4 min-w-[260px]">服务应用</th>
                <th className="py-3 px-4 min-w-[160px]">总消耗与占比</th>
                <th className="py-3 px-4 min-w-[160px]">下行 / 上行详情</th>
                <th className="py-3 px-4 min-w-[280px]">承载节点分布</th>
                <th className="py-3 px-4 text-right min-w-[120px]">请求量 / 连接</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule font-mono">
              {filteredServices.map((service, idx) => (
                <tr key={service.id} className="hover:bg-paper-hover transition-colors">
                  {/* 服务名称 */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-rule shadow-xs"
                        style={{ backgroundColor: `${service.color}15` }}
                      >
                        {renderOfficialServiceLogo(service.icon, service.id, service.color, "w-5 h-5")}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-nowrap">
                          <span className="font-semibold text-sm text-ink font-sans whitespace-nowrap">
                            {service.name}
                          </span>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border whitespace-nowrap shrink-0 leading-tight"
                            style={{
                              backgroundColor: `${service.color}15`,
                              borderColor: `${service.color}35`,
                              color: service.color,
                            }}
                          >
                            {service.categoryName}
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-muted font-mono mt-0.5 whitespace-nowrap flex items-center gap-1.5">
                          <span className="font-semibold text-ink-secondary">排名 #{idx + 1}</span>
                          <span>•</span>
                          <span>{service.activeConnections} 活跃长连接</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 消耗与占比 */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-bold text-sm text-ink">
                          {formatBytes(service.totalBytes)}
                        </span>
                        <span className="font-semibold text-accent text-xs">
                          {service.percentage}%
                        </span>
                      </div>
                      <div className="w-28 h-1.5 rounded-full bg-paper-3 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, service.percentage * 3.5)}%`,
                            backgroundColor: service.color,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* 下行 / 上行 */}
                  <td className="py-3.5 px-4 text-ink-secondary">
                    <div className="space-y-0.5 text-[11px] whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sky-400">
                        <ArrowDown className="w-3 h-3" />
                        <span>{formatBytes(service.downlinkBytes)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-400">
                        <ArrowUp className="w-3 h-3" />
                        <span>{formatBytes(service.uplinkBytes)}</span>
                      </div>
                    </div>
                  </td>

                  {/* 承载节点分布 */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {service.nodeDistribution
                        .filter((n) => n.percentage > 0)
                        .slice(0, 3)
                        .map((nd) => (
                          <span
                            key={nd.nodeId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-paper-3 border border-rule text-ink-secondary whitespace-nowrap"
                            title={`${nd.nodeName}: ${formatBytes(nd.bytes)} (${nd.percentage}%)`}
                          >
                            <span className="truncate max-w-[130px]">{nd.nodeName}</span>
                            <span className="text-accent font-semibold">{nd.percentage}%</span>
                          </span>
                        ))}
                    </div>
                  </td>

                  {/* 请求量 / 活跃连接 */}
                  <td className="py-3 px-4 text-right">
                    <div className="space-y-0.5">
                      <div className="font-bold text-ink">
                        {service.requestsCount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-ink-muted">
                        {service.activeConnections} 实时连接
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 节点分流承载矩阵 (Node Breakdown Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-semibold text-ink flex items-center gap-2">
            <HardDrives className="w-4 h-4 text-accent shrink-0" />
            <span>各 VPS 节点业务承载分布</span>
          </h3>
          <span className="text-[10px] sm:text-xs text-ink-muted font-mono">
            共纳管 {nodes.length} 个节点
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {data?.nodeDistributions.map((nd) => (
            <div
              key={nd.nodeId}
              className="p-3.5 sm:p-4 rounded-xl bg-paper-2 border border-rule space-y-3 hover:border-rule-active transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-xs sm:text-sm text-ink font-mono tracking-tight truncate">
                    {nd.nodeName}
                  </h4>
                  <div className="text-[10px] sm:text-[11px] text-ink-muted mt-0.5 font-mono truncate">
                    {nd.countryName}
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20 shrink-0">
                  {nd.percentage}%
                </span>
              </div>

              <div className="border-t border-rule-subtle pt-2 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-ink-secondary text-[11px]">
                  <span>承载总流量:</span>
                  <span className="font-bold text-ink">{formatBytes(nd.totalBytes)}</span>
                </div>

                {/* 节点主力承载服务列表 */}
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] text-ink-muted uppercase">主要业务分流：</div>
                  {nd.topServices.slice(0, 3).map((ts) => (
                    <div key={ts.serviceId} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-ink-secondary font-sans truncate max-w-[120px]">
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: ts.color }}
                        />
                        {ts.serviceName}
                      </span>
                      <span className="text-ink-muted">{formatBytes(ts.bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
