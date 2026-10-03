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

export const TrafficAnalyticsView: React.FC<TrafficAnalyticsViewProps> = ({ nodes }) => {
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d" | "month" | "all">("today");
  const [data, setData] = useState<TrafficAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [chartMode, setChartMode] = useState<"stacked" | "total">("stacked");
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

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

  // Chart max value calculation
  const maxChartValue = useMemo(() => {
    if (!data || !data.timeSeries.length) return 1;
    return Math.max(...data.timeSeries.map((p) => p.totalBytes)) * 1.15;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* 头部导航与操作栏 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-ink tracking-tight">业务流量统计与服务分析</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-accent/15 text-accent border border-accent/25">
              <Lightning className="w-3 h-3" />
              时序级多维洞悉
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            实时统计各应用服务流量消耗、分流命中走向及全网 VPS 节点分流承载矩阵
          </p>
        </div>

        {/* 时间跨度切换 & 操作按钮 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-paper-2 border border-rule rounded-lg p-0.5 text-xs font-medium">
            {(
              [
                { id: "today", label: "今日 (24h)" },
                { id: "7d", label: "近 7 天" },
                { id: "30d", label: "近 30 天" },
                { id: "month", label: "本月计费期" },
                { id: "all", label: "全部累计" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  timeRange === t.id
                    ? "bg-paper-3 text-accent font-semibold shadow-xs"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-2 hover:bg-paper-hover text-ink-secondary hover:text-ink text-xs font-medium border border-rule transition-colors cursor-pointer"
            title="刷新统计数据"
          >
            <ArrowClockwise className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent" : ""}`} />
            <span>刷新</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-2 hover:bg-paper-hover text-ink-secondary hover:text-ink text-xs font-medium border border-rule transition-colors cursor-pointer"
            title="导出 JSON 流量报告"
          >
            <DownloadSimple className="w-3.5 h-3.5" />
            <span>导出报告</span>
          </button>
        </div>
      </div>

      {/* 顶部 4 大核心指标看板 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 卡片 1: 监测总流量 */}
        <div className="p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">监测总流量消耗</span>
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <ChartBar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-ink tracking-tight">
              {data ? formatBytes(data.totalRecordedBytes) : "--"}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[11px] font-mono text-ink-muted">
            <span className="flex items-center gap-0.5 text-sky-400">
              <ArrowDown className="w-3 h-3" />
              下行: {data ? formatBytes(data.totalDownlinkBytes) : "--"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-0.5 text-purple-400">
              <ArrowUp className="w-3 h-3" />
              上行: {data ? formatBytes(data.totalUplinkBytes) : "--"}
            </span>
          </div>
        </div>

        {/* 卡片 2: Top 1 霸榜服务 */}
        <div className="p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">流量消耗霸榜服务</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <YoutubeOfficialLogo className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-ink tracking-tight">
              {topService ? topService.name : "--"}
            </span>
            {topService && (
              <span className="text-xs font-mono font-semibold text-rose-400">
                {topService.percentage}%
              </span>
            )}
          </div>
          <div className="mt-2.5 text-[11px] font-mono text-ink-muted flex items-center gap-1.5">
            <span>消耗:</span>
            <span className="font-semibold text-ink">
              {topService ? formatBytes(topService.totalBytes) : "--"}
            </span>
            <span>• 主要由主力直连承载</span>
          </div>
        </div>

        {/* 卡片 3: AI 办公智能流量 */}
        <div className="p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">AI 智能服务累计消耗</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <OpenAiOfficialLogo className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              {formatBytes(aiTraffic)}
            </span>
            <span className="text-xs font-mono font-semibold text-ink-muted">
              ({aiPercentage}%)
            </span>
          </div>
          <div className="mt-2.5 text-[11px] font-mono text-ink-muted flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>OpenAI / Claude 全由落地解锁机分流</span>
          </div>
        </div>

        {/* 卡片 4: 业务调度请求数 & 实时流 */}
        <div className="p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">调度请求数 / 活跃流</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <HardDrives className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-ink tracking-tight">
              {data ? data.totalRequests.toLocaleString() : "--"}
            </span>
            <span className="text-xs font-mono text-ink-muted">次</span>
          </div>
          <div className="mt-2.5 text-[11px] font-mono text-ink-muted flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>实时活跃长连接:</span>
            <span className="font-semibold text-accent font-mono">
              {data?.activeStreams || 0} 个
            </span>
          </div>
        </div>
      </div>

      {/* 中部图表分析区域：时序流量趋势 + 业务类别分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧 2/3: 时序流量趋势柱状堆叠图 */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-paper-2 border border-rule space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <ChartBar className="w-4 h-4 text-accent" />
                流量时序分布曲线 ({timeRange === "today" ? "24 小时" : timeRange === "7d" ? "近 7 天" : "周期分布"})
              </h3>
              <p className="text-[11px] text-ink-muted mt-0.5">
                鼠标悬停柱状图查看对应时间切片的分类流量构成
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-paper-3 border border-rule rounded-md p-0.5 text-[11px]">
              <button
                onClick={() => setChartMode("stacked")}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  chartMode === "stacked" ? "bg-accent/20 text-accent font-semibold" : "text-ink-muted hover:text-ink"
                }`}
                title="各业务分类堆叠展示"
              >
                分类堆叠
              </button>
              <button
                onClick={() => setChartMode("total")}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  chartMode === "total" ? "bg-accent/20 text-accent font-semibold" : "text-ink-muted hover:text-ink"
                }`}
                title="按时序流量展示单色总量走势"
              >
                总量趋势
              </button>
            </div>
          </div>

          {/* 交互图表容器 */}
          <div className="h-52 relative flex items-end gap-1 sm:gap-1.5 pt-6 border-b border-rule mb-8">
            {/* 背景横向参考标线（提供视觉基准，明确高度对齐） */}
            <div className="absolute inset-x-0 top-6 bottom-0 pointer-events-none flex flex-col justify-between z-0">
              <div className="border-b border-rule/50 border-dashed w-full relative">
                <span className="absolute -top-3.5 right-0 text-[9px] font-mono text-ink-muted/70">
                  {formatBytes(maxChartValue)}
                </span>
              </div>
              <div className="border-b border-rule/30 border-dashed w-full relative">
                <span className="absolute -top-3.5 right-0 text-[9px] font-mono text-ink-muted/50">
                  {formatBytes(maxChartValue * 0.5)}
                </span>
              </div>
              <div className="w-full" />
            </div>

            {data?.timeSeries.map((p, idx) => {
              const heightPct = Math.max(8, (p.totalBytes / maxChartValue) * 100);
              const isHovered = hoveredPointIdx === idx;
              const isTick =
                timeRange === "today"
                  ? idx % 3 === 0
                  : timeRange === "7d"
                  ? true
                  : idx % 5 === 0 || idx === data.timeSeries.length - 1;

              const sumB = (p.streamingBytes + p.aiBytes + p.socialBytes + p.devBytes) || p.totalBytes || 1;
              const streamPct = Math.round((p.streamingBytes / sumB) * 100);
              const aiPct = Math.round((p.aiBytes / sumB) * 100);
              const socPct = Math.round((p.socialBytes / sumB) * 100);
              const devPct = Math.max(0, 100 - streamPct - aiPct - socPct);

              return (
                <div
                  key={`${p.time}-${idx}`}
                  className="flex-1 h-full flex flex-col justify-end items-center relative group cursor-pointer z-10"
                  onMouseEnter={() => setHoveredPointIdx(idx)}
                  onMouseLeave={() => setHoveredPointIdx(null)}
                >
                  {/* 全高背景槽位导轨：为视觉系统提供清晰贯穿的垂直几何基准，锁定中轴 */}
                  <div className="absolute inset-y-0 w-4 rounded-none bg-paper-3/20 border-x border-rule/20 pointer-events-none -z-10" />

                  {/* Tooltip 浮动框 */}
                  {isHovered && (
                    <div className="absolute bottom-[calc(100%+8px)] z-30 p-2.5 rounded-lg bg-paper-3 border border-rule shadow-xl text-xs font-mono space-y-1 pointer-events-none min-w-[170px] left-1/2 -translate-x-1/2">
                      <div className="font-semibold text-ink border-b border-rule-subtle pb-1 flex items-center justify-between">
                        <span>{p.time}</span>
                        <span className="text-accent">{formatBytes(p.totalBytes)}</span>
                      </div>
                      <div className="text-[11px] space-y-0.5 pt-0.5">
                        <div className="flex justify-between text-rose-400">
                          <span>流媒体:</span>
                          <span>{formatBytes(p.streamingBytes)} ({streamPct}%)</span>
                        </div>
                        <div className="flex justify-between text-emerald-400">
                          <span>AI 应用:</span>
                          <span>{formatBytes(p.aiBytes)} ({aiPct}%)</span>
                        </div>
                        <div className="flex justify-between text-sky-400">
                          <span>社交:</span>
                          <span>{formatBytes(p.socialBytes)} ({socPct}%)</span>
                        </div>
                        <div className="flex justify-between text-purple-300">
                          <span>开发:</span>
                          <span>{formatBytes(p.devBytes)} ({devPct}%)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 柱子主体：严格直角矩形柱身 + 显式垂直外轮廓 + 均衡明度色块 */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-4 rounded-none border border-white/20 overflow-hidden flex flex-col justify-end divide-y divide-paper transition-all shrink-0 ${
                      isHovered ? "brightness-125 ring-2 ring-accent/80 z-20" : "opacity-95"
                    }`}
                  >
                    {chartMode !== "total" ? (
                      <>
                        <div style={{ flex: `${p.streamingBytes || 55} 1 0px` }} className="bg-rose-500 w-full min-h-[1px]" />
                        <div style={{ flex: `${p.aiBytes || 22} 1 0px` }} className="bg-emerald-500 w-full min-h-[1px]" />
                        <div style={{ flex: `${p.socialBytes || 13} 1 0px` }} className="bg-sky-500 w-full min-h-[1px]" />
                        <div style={{ flex: `${p.devBytes || 10} 1 0px` }} className="bg-purple-400 w-full min-h-[1px]" />
                      </>
                    ) : (
                      <div className="bg-accent w-full h-full" />
                    )}
                  </div>

                  {/* X 轴刻度指示与正下方绝对居中文本 */}
                  {isTick ? (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none pt-1">
                      <div className="w-[1.5px] h-1 bg-rule-active mb-1.5" />
                      <span className="text-[10px] font-mono text-ink-muted whitespace-nowrap text-center leading-none">
                        {p.time}
                      </span>
                    </div>
                  ) : (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none pt-1">
                      <div className="w-[1px] h-0.5 bg-rule/50 mb-1.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 图例 */}
          <div className="flex items-center justify-between pt-4 flex-wrap gap-2 text-xs font-mono">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                流媒体
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                AI 智能
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
                社交通讯
              </span>
              <span className="flex items-center gap-1.5 text-purple-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-purple-400 inline-block" />
                开发托管
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">高峰时段：20:00 - 23:00</span>
          </div>
        </div>

        {/* 右侧 1/3: 类别占比环形 / 比例列表 */}
        <div className="p-5 rounded-xl bg-paper-2 border border-rule space-y-4">
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
        <div className="p-4 border-b border-rule flex flex-col md:flex-row md:items-center justify-between gap-3 bg-paper-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink">服务流量消耗明细</span>
            <span className="text-xs text-ink-muted font-mono">
              ({filteredServices.length} 个服务)
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 分类筛选胶囊 */}
            <div className="flex items-center gap-1 bg-paper-3 p-0.5 rounded-lg border border-rule text-xs">
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
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
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
            <div className="w-48 sm:w-56">
              <Input
                prefixIcon={<MagnifyingGlass className="w-3.5 h-3.5" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索服务应用名称..."
              />
            </div>
          </div>
        </div>

        {/* 服务明细表格 */}
        <div className="overflow-x-auto">
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
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <HardDrives className="w-4 h-4 text-accent" />
            各 VPS 节点业务承载分布
          </h3>
          <span className="text-xs text-ink-muted font-mono">
            共纳管 {nodes.length} 个节点
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data?.nodeDistributions.map((nd) => (
            <div
              key={nd.nodeId}
              className="p-4 rounded-xl bg-paper-2 border border-rule space-y-3 hover:border-rule-active transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-ink font-mono tracking-tight truncate max-w-[160px]">
                    {nd.nodeName}
                  </h4>
                  <div className="text-[11px] text-ink-muted mt-0.5 font-mono">
                    {nd.countryName}
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
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
