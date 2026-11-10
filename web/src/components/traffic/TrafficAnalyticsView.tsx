import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DownloadSimple, ArrowClockwise } from "@phosphor-icons/react";
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

const quotaTone = (pct: number) =>
  pct >= 95
    ? { text: "text-status-danger", bar: "bg-status-danger" }
    : pct >= 80
    ? { text: "text-status-warning", bar: "bg-status-warning" }
    : { text: "text-ink-secondary", bar: "bg-accent" };

const KpiCard: React.FC<{ label: string; value: React.ReactNode; footer: React.ReactNode }> = ({ label, value, footer }) => (
  <div className="p-4 sm:p-[18px] rounded-xl bg-paper-2 border border-rule flex flex-col gap-2 min-w-0">
    <span className="text-[13px] text-ink-secondary truncate">{label}</span>
    <span className="font-mono text-xl sm:text-[26px] leading-tight text-ink truncate">{value}</span>
    <span className="font-mono text-xs text-ink-muted truncate">{footer}</span>
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
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const distributions = data?.nodeDistributions ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 min-w-[260px] text-sm text-ink-secondary">
          来自各节点网卡的实测累计值，不含估算。历史数据保留 35 天。
        </p>
        <div
          role="group"
          aria-label="时间范围"
          className="flex p-[3px] gap-0.5 rounded-[9px] border border-rule bg-paper-2 overflow-x-auto no-scrollbar max-w-full"
        >
          {RANGES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={timeRange === t.id}
              onClick={() => setTimeRange(t.id)}
              className={`h-8 px-3 rounded-md text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                timeRange === t.id ? "bg-paper-3 text-ink" : "text-ink-secondary hover:text-ink"
              }`}
            >
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => fetchAnalytics()}
          disabled={loading}
          aria-label="刷新统计数据"
          title="刷新统计数据"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-rule bg-paper-2 text-ink-secondary hover:text-ink cursor-pointer transition-colors"
        >
          <ArrowClockwise className={`w-4 h-4 ${loading ? "animate-spin text-accent" : ""}`} />
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="h-9 px-3.5 flex items-center gap-2 rounded-lg border border-rule bg-paper-2 text-[13px] font-medium text-ink hover:border-rule-active cursor-pointer transition-colors"
        >
          <DownloadSimple className="w-4 h-4" />
          导出 JSON
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-status-danger-bg text-[13px] text-status-danger">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="总流量"
          value={data ? formatBytes(data.totalRecordedBytes, 2) : "--"}
          footer={
            <>
              <span className="text-accent">↓ {data ? formatBytes(data.totalDownlinkBytes) : "--"}</span>
              <span> · </span>
              <span className="text-violet-600 dark:text-[#A58BFA]">↑ {data ? formatBytes(data.totalUplinkBytes) : "--"}</span>
            </>
          }
        />
        <KpiCard
          label={`峰值${bucketName}`}
          value={peak && peak.totalBytes > 0 ? formatBytes(peak.totalBytes) : "--"}
          footer={peak && peak.totalBytes > 0 ? bucketTitle(peak.timestamp, timeRange) : "暂无数据"}
        />
        <KpiCard label={`平均每${bucketName}`} value={data ? formatBytes(average) : "--"} footer={`共 ${series.length} 个统计区间`} />
        <KpiCard
          label="产生流量的节点"
          value={
            <>
              {data ? activeNodes : "--"}
              <span className="text-sm text-ink-muted"> / {nodes.length}</span>
            </>
          }
          footer={`共纳管 ${nodes.length} 个节点`}
        />
      </div>

      <section className="p-4 sm:p-5 rounded-xl bg-paper-2 border border-rule space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-ink">每{bucketName}流量</h2>
          <span className="ml-auto text-xs text-ink-muted">悬停或点击柱体查看区间流量</span>
        </div>

        <div className="relative flex items-stretch mb-6 select-none">
          <div className="w-14 shrink-0 flex flex-col justify-between text-right text-[11px] font-mono text-ink-muted pr-2.5">
            <span className="leading-none">{formatBytes(axisMax, 0)}</span>
            <span className="leading-none">{formatBytes(axisMax / 2, 0)}</span>
            <span className="leading-none">0</span>
          </div>

          <div className="flex-1 min-w-0 h-60 relative flex items-end gap-0.5 sm:gap-1.5 border-b border-rule">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-rule-subtle pointer-events-none" aria-hidden="true" />
            {series.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-muted">
                {loading ? "加载中…" : "暂无流量记录"}
              </div>
            )}
            {series.map((p, idx) => {
              const isHovered = hoveredIdx === idx;
              const tooltipAlign = idx <= 2 ? "left-0" : idx >= series.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
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
                      className={`absolute bottom-[calc(100%+8px)] z-30 px-2.5 py-1.5 rounded-lg bg-paper-3 border border-rule shadow-pop text-xs pointer-events-none whitespace-nowrap ${tooltipAlign}`}
                    >
                      <span className="text-ink-muted">{bucketTitle(p.timestamp, timeRange)}</span>
                      <span className="ml-3 text-ink font-mono">{formatBytes(p.totalBytes, 2)}</span>
                    </div>
                  )}
                  <div
                    style={{ height: `${Math.max(1, (p.totalBytes / axisMax) * 100)}%` }}
                    className={`w-full max-w-[32px] rounded-t-[3px] bg-accent transition-opacity duration-150 ${
                      hoveredIdx !== null && !isHovered ? "opacity-40" : ""
                    }`}
                  />
                  {isTick && (
                    <span className="absolute top-full mt-2 text-[11px] font-mono text-ink-muted whitespace-nowrap leading-none">
                      {bucketLabel(p.timestamp, timeRange)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-paper-2 border border-rule min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">按节点</h2>
          <span className="text-xs text-ink-muted">占比为所选时间范围内的总流量占比；配额为当月累计</span>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-y border-rule text-left text-xs text-ink-muted">
                <th className="h-10 pl-4 sm:pl-5 pr-3 font-medium">节点</th>
                <th className="h-10 px-3 font-medium text-right">时段流量</th>
                <th className="h-10 px-3 font-medium w-[260px]">占比</th>
                <th className="h-10 px-3 pr-5 font-medium w-[220px]">本月配额</th>
              </tr>
            </thead>
            <tbody>
              {distributions.length === 0 && (
                <tr>
                  <td colSpan={4} className="h-16 text-center text-[13px] text-ink-muted">
                    {loading ? "加载中…" : "所选时段暂无流量记录"}
                  </td>
                </tr>
              )}
              {distributions.map((nd) => {
                const node = nodeById.get(nd.nodeId);
                const qPct =
                  node && node.trafficLimitBytes > 0 ? Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100) : 0;
                const tone = quotaTone(qPct);
                return (
                  <tr key={nd.nodeId} className="border-b border-rule-subtle last:border-0">
                    <td className="h-12 pl-4 sm:pl-5 pr-3 text-[13px]">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-[11px] text-ink-muted w-[22px] shrink-0">{nd.country}</span>
                        <span className="truncate text-ink" title={nd.countryName}>
                          {nd.nodeName}
                        </span>
                      </span>
                    </td>
                    <td className="h-12 px-3 text-right font-mono text-[13px] text-ink">{formatBytes(nd.totalBytes)}</td>
                    <td className="h-12 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 rounded-sm bg-paper-3 overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${nd.percentage}%` }} />
                        </div>
                        <span className="w-12 text-right font-mono text-xs text-ink-secondary">{nd.percentage}%</span>
                      </div>
                    </td>
                    <td className="h-12 px-3 pr-5">
                      {node ? (
                        <div className="flex flex-col gap-1">
                          <span className={`font-mono text-xs ${tone.text}`}>
                            {formatBytes(node.trafficUsedBytes)} / {node.trafficLimitBytes > 0 ? formatBytes(node.trafficLimitBytes, 0) : "不限"}
                          </span>
                          <div className="h-1 rounded-sm bg-paper-3 overflow-hidden">
                            <div className={`h-full ${tone.bar}`} style={{ width: `${qPct}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-muted">节点已删除</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
