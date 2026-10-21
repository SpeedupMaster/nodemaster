import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChartBar,
  ChartPieSlice,
  HardDrives,
  DownloadSimple,
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  Lightning,
  TrendUp,
  Gauge,
} from "@phosphor-icons/react";
import { TrafficAnalyticsSummary, TrafficRange, TrafficTimeSeriesPoint, NodeItem } from "../../types";
import { api, apiFetch } from "../../services/api";
import { formatBytes, GB } from "../../utils/format";

interface TrafficAnalyticsViewProps {
  nodes: NodeItem[];
}

const RANGES: { id: TrafficRange; label: string; short: string }[] = [
  { id: "today", label: "今日 (24h)", short: "今日" },
  { id: "7d", label: "近 7 天", short: "7天" },
  { id: "30d", label: "近 30 天", short: "30天" },
  { id: "month", label: "本自然月", short: "本月" },
  { id: "all", label: "已保留历史", short: "全部" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Bucket label in the browser's timezone: hours for "today", days otherwise. */
function bucketLabel(timestamp: number, range: TrafficRange): string {
  const d = new Date(timestamp);
  return range === "today" ? `${pad(d.getHours())}:00` : `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function bucketTitle(timestamp: number, range: TrafficRange): string {
  if (range !== "today") return bucketLabel(timestamp, range);
  const h = new Date(timestamp).getHours();
  return `${pad(h)}:00 - ${pad((h + 1) % 24)}:00`;
}

/** Rounds the axis maximum up to a readable step in the value's own unit. */
function niceMax(maxValue: number): number {
  if (maxValue <= 0) return GB;
  const exp = Math.min(4, Math.floor(Math.log(maxValue) / Math.log(1024)));
  const unit = 1024 ** exp;
  const steps = [1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 80, 100, 200, 250, 400, 500, 800, 1000];
  const value = maxValue / unit;
  return (steps.find((s) => s >= value) ?? Math.ceil(value)) * unit;
}

const KpiCard: React.FC<{ label: string; icon: React.ReactNode; value: string; footer: React.ReactNode }> = ({
  label,
  icon,
  value,
  footer,
}) => (
  <div className="p-3 sm:p-4 rounded-xl bg-paper-2 border border-rule flex flex-col justify-between">
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] sm:text-xs font-medium text-ink-secondary truncate">{label}</span>
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
          {icon}
        </div>
      </div>
      <span className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono text-ink tracking-tight truncate block">
        {value}
      </span>
    </div>
    <div className="mt-2 sm:mt-2.5 text-[10px] sm:text-[11px] font-mono text-ink-muted truncate">{footer}</div>
  </div>
);

export const TrafficAnalyticsView: React.FC<TrafficAnalyticsViewProps> = ({ nodes }) => {
  const [timeRange, setTimeRange] = useState<TrafficRange>("today");
  const [data, setData] = useState<TrafficAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const fetchAnalytics = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        setData(await api<TrafficAnalyticsSummary>("GET", `/api/traffic/analytics?range=${timeRange}`, undefined, signal));
        setError(null);
      } catch (err: any) {
        if (err.name !== "AbortError") setError(err.message || "加载流量统计失败");
      } finally {
        setLoading(false);
      }
    },
    [timeRange],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalytics(controller.signal);
    return () => controller.abort();
  }, [fetchAnalytics]);

  const handleExport = async () => {
    try {
      const response = await apiFetch(`/api/traffic/export?range=${timeRange}`);
      if (!response.ok) throw new Error("导出失败，请重新登录后重试");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `nodemaster-traffic-${timeRange}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      window.alert(err.message || "导出失败");
    }
  };

  const series: TrafficTimeSeriesPoint[] = data?.timeSeries ?? [];
  const axisMax = useMemo(() => niceMax(Math.max(0, ...series.map((p) => p.totalBytes))), [series]);
  const peak = useMemo(
    () => series.reduce<TrafficTimeSeriesPoint | null>((best, p) => (!best || p.totalBytes > best.totalBytes ? p : best), null),
    [series],
  );
  const average = series.length ? (data?.totalRecordedBytes ?? 0) / series.length : 0;
  const activeNodes = data?.nodeDistributions.filter((n) => n.totalBytes > 0).length ?? 0;
  const bucketName = timeRange === "today" ? "小时" : "天";
  const tickEvery = series.length <= 8 ? 1 : series.length <= 24 ? 3 : 5;

  return (
    <div className="space-y-6">
      {/* 头部与操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-xl font-bold text-ink tracking-tight">流量统计</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-medium bg-accent/15 text-accent border border-accent/25 shrink-0">
              <Lightning className="w-3 h-3" />
              实测数据
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5 hidden sm:block">
            统计来自探针网卡累计计数，不含业务分类等推算数据。历史保留 35 天。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <div className="flex items-center bg-paper-2 border border-rule rounded-lg p-0.5 text-xs font-medium overflow-x-auto no-scrollbar flex-1 sm:flex-initial">
            {RANGES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-2 sm:px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 text-center ${
                  timeRange === t.id ? "bg-paper-3 text-accent font-semibold shadow-xs" : "text-ink-secondary hover:text-ink"
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

      {error && (
        <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400">{error}</div>
      )}

      {/* 核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard
          label="总流量"
          icon={<ChartBar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          value={data ? formatBytes(data.totalRecordedBytes, 2) : "--"}
          footer={
            <span className="flex items-center gap-1.5 sm:gap-2">
              <span className="flex items-center gap-0.5 text-sky-400">
                <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                {data ? formatBytes(data.totalDownlinkBytes) : "--"}
              </span>
              <span className="opacity-40">•</span>
              <span className="flex items-center gap-0.5 text-purple-400">
                <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                {data ? formatBytes(data.totalUplinkBytes) : "--"}
              </span>
            </span>
          }
        />
        <KpiCard
          label={`峰值${bucketName}`}
          icon={<TrendUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          value={peak && peak.totalBytes > 0 ? formatBytes(peak.totalBytes) : "--"}
          footer={peak && peak.totalBytes > 0 ? bucketTitle(peak.timestamp, timeRange) : "暂无数据"}
        />
        <KpiCard
          label={`平均每${bucketName}`}
          icon={<Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          value={data ? formatBytes(average) : "--"}
          footer={`共 ${series.length} 个统计区间`}
        />
        <KpiCard
          label="产生流量的节点"
          icon={<HardDrives className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          value={data ? String(activeNodes) : "--"}
          footer={`共纳管 ${nodes.length} 个节点`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 时序柱状图 */}
        <div className="lg:col-span-2 p-3.5 sm:p-6 rounded-xl bg-paper-2 border border-rule space-y-4 overflow-hidden min-w-0">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-ink flex items-center gap-2">
              <ChartBar className="w-4 h-4 text-accent shrink-0" />
              <span>流量时序走势（每{bucketName}）</span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-ink-muted mt-0.5">悬停或点击柱体查看该区间流量</p>
          </div>

          <div className="relative flex items-stretch pt-1 mb-6 select-none">
            <div className="w-12 sm:w-14 shrink-0 flex flex-col justify-between text-right text-[10px] font-mono text-ink-muted/70 pr-2.5">
              <span className="leading-none">{formatBytes(axisMax, 0)}</span>
              <span className="leading-none">{formatBytes(axisMax / 2, 0)}</span>
              <span className="leading-none text-ink-muted/40">0</span>
            </div>

            <div className="flex-1 min-w-0 h-56 relative flex items-end gap-0.5 sm:gap-1 px-0.5 border-b border-rule">
              {series.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-muted">
                  {loading ? "加载中…" : "暂无流量记录"}
                </div>
              )}
              {series.map((p, idx) => {
                const isHovered = hoveredIdx === idx;
                const tooltipAlign =
                  idx <= 2 ? "left-0" : idx >= series.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
                const isTick = idx % tickEvery === 0 || idx === series.length - 1;
                return (
                  <div
                    key={p.timestamp}
                    className="flex-1 min-w-0 h-full flex flex-col justify-end items-center relative cursor-pointer touch-manipulation"
                    onClick={() => setHoveredIdx(isHovered ? null : idx)}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {isHovered && (
                      <div
                        className={`absolute bottom-[calc(100%+8px)] z-30 px-2.5 py-1.5 rounded-lg bg-paper-3/95 backdrop-blur-sm border border-rule shadow-xl text-[11px] font-mono pointer-events-none whitespace-nowrap ${tooltipAlign}`}
                      >
                        <span className="text-ink-muted font-sans">{bucketTitle(p.timestamp, timeRange)}</span>
                        <span className="ml-3 text-accent font-bold">{formatBytes(p.totalBytes, 2)}</span>
                      </div>
                    )}
                    <div
                      style={{ height: `${Math.max(1, (p.totalBytes / axisMax) * 100)}%` }}
                      className={`w-full max-w-[28px] rounded-t-xs bg-accent transition-all duration-200 ${
                        isHovered ? "brightness-125" : hoveredIdx !== null ? "opacity-40" : "opacity-90"
                      }`}
                    />
                    {isTick && (
                      <span className="absolute top-full mt-2 text-[10px] font-mono text-ink-muted whitespace-nowrap leading-none">
                        {bucketLabel(p.timestamp, timeRange)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 节点流量分布 */}
        <div className="p-3.5 sm:p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <ChartPieSlice className="w-4 h-4 text-accent" />
              节点流量分布
            </h3>
            <span className="text-[11px] text-ink-muted font-mono">{data?.nodeDistributions.length ?? 0} 个节点有流量</span>
          </div>

          <div className="space-y-3 pt-1">
            {data?.nodeDistributions.length === 0 && <div className="text-xs text-ink-muted">所选时段暂无流量记录</div>}
            {data?.nodeDistributions.map((nd) => (
              <div key={nd.nodeId} className="space-y-1 font-mono text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink font-sans font-medium truncate" title={nd.countryName}>
                    {nd.nodeName}
                  </span>
                  <div className="flex items-center gap-2 text-ink-muted shrink-0">
                    <span className="font-semibold text-ink">{formatBytes(nd.totalBytes)}</span>
                    <span className="text-accent font-semibold">{nd.percentage}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${nd.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
