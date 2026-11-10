import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { RollingCounter } from "../common/RollingCounter";
import { formatBytes, formatSpeed, toGB } from "../../utils/format";
import { api } from "../../services/api";
import type { NodeItem, TrafficAnalyticsSummary } from "../../types";

interface OverviewCardsProps {
  nodes: NodeItem[];
  totalTrafficUsed: number;
  totalTrafficLimit: number;
  totalUpSpeed: number;
  totalDownSpeed: number;
  onlineCount: number;
  totalCount: number;
  relaysCount: number;
  onSelectNode: (node: NodeItem) => void;
  onSelectTab: (tab: string) => void;
}

type Severity = "danger" | "warning" | "info";
interface AttentionItem {
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
}

const DOT: Record<Severity, string> = {
  danger: "bg-status-danger",
  warning: "bg-status-warning",
  info: "bg-accent",
};

const DAY_MS = 86_400_000;
const SPARK_POINTS = 40;

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / DAY_MS);
}

/** Things an operator should act on, most urgent first */
function buildAttention(nodes: NodeItem[], onSelectNode: (n: NodeItem) => void, onSelectTab: (t: string) => void): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const n of nodes) {
    const open = () => onSelectNode(n);
    const label = `${n.country} ${n.name}`;
    if (n.status === "circuit_broken") {
      items.push({ key: `cb-${n.id}`, severity: "danger", title: `${label} 已熔断`, detail: `本月流量 ${toGB(n.trafficUsedBytes)} / ${toGB(n.trafficLimitBytes)} GB 已耗尽，代理已自动停止`, action: "查看", onAction: open });
    } else if (n.status === "offline") {
      items.push({ key: `off-${n.id}`, severity: "danger", title: `${label} 离线`, detail: n.lastSeen ? `最后心跳 ${new Date(n.lastSeen).toLocaleString("zh-CN", { hour12: false })}` : "尚未收到探针心跳", action: "查看", onAction: open });
    }
    if (n.configSyncStatus === "failed") {
      items.push({ key: `sync-${n.id}`, severity: "danger", title: `${label} 配置同步失败`, detail: n.configSyncError || "节点未能应用最新的 Xray 配置", action: "查看", onAction: open });
    }
    const days = daysUntil(n.expiresAt);
    if (days !== null && days < 0) {
      items.push({ key: `exp-${n.id}`, severity: "danger", title: `${label} 已过期 ${-days} 天`, detail: "请确认是否已续费，否则 VPS 可能被回收", action: "查看", onAction: open });
    } else if (days !== null && days <= 30) {
      items.push({ key: `exp-${n.id}`, severity: "warning", title: `${label} 将于 ${days} 天后到期`, detail: n.autoRenew ? "已开启自动续费，请确认余额充足" : "未开启自动续费", action: "查看", onAction: open });
    }
    const pct = n.trafficLimitBytes > 0 ? (n.trafficUsedBytes / n.trafficLimitBytes) * 100 : 0;
    if (n.status !== "circuit_broken" && pct >= 80) {
      items.push({ key: `tr-${n.id}`, severity: "warning", title: `${label} 流量已用 ${pct.toFixed(0)}%`, detail: `${toGB(n.trafficUsedBytes)} / ${toGB(n.trafficLimitBytes)} GB，耗尽后将自动熔断`, action: "查看", onAction: open });
    }
  }
  if (typeof window !== "undefined" && window.location.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
    items.push({ key: "http", severity: "warning", title: "面板正通过明文 HTTP 访问", detail: "节点 Token 与安装脚本可能被链路劫持，建议配置 HTTPS 反向代理", action: "了解", onAction: () => onSelectTab("script") });
  }
  const rank: Record<Severity, number> = { danger: 0, warning: 1, info: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

const Card: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = "" }) => (
  <div className={`p-[18px] rounded-xl bg-paper-2 border border-rule flex flex-col gap-2.5 min-w-0 ${className}`}>
    <span className="text-[13px] text-ink-secondary">{label}</span>
    {children}
  </div>
);

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  nodes,
  totalTrafficUsed,
  totalTrafficLimit,
  totalUpSpeed,
  totalDownSpeed,
  onlineCount,
  totalCount,
  relaysCount,
  onSelectNode,
  onSelectTab,
}) => {
  // Live throughput history, sampled whenever telemetry updates
  const [spark, setSpark] = useState<number[]>([]);
  const lastSample = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastSample.current < 2500) return;
    lastSample.current = now;
    setSpark((prev) => [...prev, totalDownSpeed].slice(-SPARK_POINTS));
  }, [totalDownSpeed]);

  // Today's hourly traffic for the chart
  const [today, setToday] = useState<TrafficAnalyticsSummary | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const load = () =>
      api<TrafficAnalyticsSummary>("GET", "/api/traffic/analytics?range=today", undefined, ctrl.signal)
        .then(setToday)
        .catch(() => {});
    load();
    const timer = window.setInterval(load, 5 * 60_000);
    return () => {
      ctrl.abort();
      window.clearInterval(timer);
    };
  }, []);

  const attention = useMemo(() => buildAttention(nodes, onSelectNode, onSelectTab), [nodes, onSelectNode, onSelectTab]);

  const usedGB = Number(toGB(totalTrafficUsed));
  const limitGB = Number(toGB(totalTrafficLimit));
  const trafficPct = limitGB > 0 ? Math.min(100, (usedGB / limitGB) * 100) : 0;
  const up = formatSpeed(totalUpSpeed);
  const down = formatSpeed(totalDownSpeed);
  const reporting = nodes.filter((n) => n.status === "online");
  const avgCpu = reporting.length ? reporting.reduce((a, n) => a + n.cpuUsage, 0) / reporting.length : 0;
  const avgMem = reporting.length ? reporting.reduce((a, n) => a + n.memUsage, 0) / reporting.length : 0;
  const broken = nodes.filter((n) => n.status === "circuit_broken").length;
  const offline = nodes.filter((n) => n.status === "offline").length;

  const sparkMax = Math.max(1, ...spark);
  const sparkPts = spark.map((v, i) => `${(i / Math.max(1, SPARK_POINTS - 1)) * 200},${32 - (v / sparkMax) * 28}`).join(" ");

  const series = today?.timeSeries ?? [];
  const seriesMax = Math.max(1, ...series.map((p) => p.totalBytes));
  const peak = series.reduce<(typeof series)[number] | null>((b, p) => (!b || p.totalBytes > b.totalBytes ? p : b), null);
  const hour = (ts: number) => new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-ink-secondary">
          <span className={`font-semibold ${onlineCount === totalCount ? "text-status-online" : "text-status-warning"}`}>
            {onlineCount} / {totalCount} 节点在线
          </span>
          {broken > 0 && <> · {broken} 台已熔断</>}
          {offline > 0 && <> · {offline} 台离线</>}
          {relaysCount > 0 && <> · {relaysCount} 条链式解锁链路</>}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="实时吞吐" className="col-span-2 sm:col-span-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-mono text-2xl text-ink">
              ↓ <RollingCounter value={down.val} decimals={1} />
              <span className="text-sm text-ink-muted"> {down.unit}</span>
            </span>
            <span className="font-mono text-sm text-ink-secondary">↑ {up.val.toFixed(1)} {up.unit}</span>
          </div>
          <svg viewBox="0 0 200 32" preserveAspectRatio="none" className="w-full h-8" aria-hidden="true">
            {spark.length > 1 && <polyline points={sparkPts} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
          </svg>
        </Card>
        <Card label="本月流量" className="col-span-2 sm:col-span-1">
          <span className="font-mono text-2xl text-ink">
            {formatBytes(totalTrafficUsed)}
            <span className="text-sm text-ink-muted"> / {formatBytes(totalTrafficLimit)}</span>
          </span>
          <div className="h-1.5 rounded-full bg-paper-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out-expo ${trafficPct > 90 ? "bg-status-danger" : trafficPct > 75 ? "bg-status-warning" : "bg-accent"}`}
              style={{ width: `${trafficPct}%` }}
            />
          </div>
          <span className="text-xs text-ink-muted">已用 {trafficPct.toFixed(1)}%</span>
        </Card>
        <Card label="节点">
          <span className="font-mono text-2xl text-ink">
            {onlineCount}
            <span className="text-sm text-ink-muted"> / {totalCount} 在线</span>
          </span>
          <span className="text-xs text-ink-muted">
            {nodes.filter((n) => n.type === "direct").length} 主力直连 · {nodes.filter((n) => n.type === "unlock").length} 解锁落地 · {nodes.filter((n) => n.type === "probe").length} 探针
          </span>
        </Card>
        <Card label="资源负载（在线均值）">
          <div className="flex gap-5">
            <div className="flex flex-col">
              <span className="font-mono text-2xl text-ink">{avgCpu.toFixed(1)}%</span>
              <span className="text-xs text-ink-muted">CPU</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-2xl text-ink">{avgMem.toFixed(1)}%</span>
              <span className="text-xs text-ink-muted">内存</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <section className="lg:col-span-2 p-5 rounded-xl bg-paper-2 border border-rule flex flex-col gap-3.5 min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className="text-[15px] font-semibold text-ink">今日流量</h2>
            <span className="text-xs text-ink-muted">每小时 · 全部节点</span>
            {peak && (
              <span className="ml-auto font-mono text-xs text-ink-muted">
                峰值 {formatBytes(peak.totalBytes)} · {hour(peak.timestamp)}
              </span>
            )}
          </div>
          <div className="flex items-end gap-1.5 h-44 border-b border-rule">
            {series.length === 0 && <div className="m-auto text-sm text-ink-muted">暂无今日流量数据</div>}
            {series.map((p) => (
              <div
                key={p.timestamp}
                title={`${hour(p.timestamp)} · ${formatBytes(p.totalBytes)}`}
                className="flex-1 rounded-t-[3px] bg-accent/80 hover:bg-accent transition-colors min-h-[2px]"
                style={{ height: `${(p.totalBytes / seriesMax) * 100}%` }}
              />
            ))}
          </div>
          {series.length > 0 && (
            <div className="flex justify-between font-mono text-[11px] text-ink-muted">
              <span>{hour(series[0].timestamp)}</span>
              <span>{hour(series[series.length - 1].timestamp)}</span>
            </div>
          )}
        </section>

        <section className="p-5 rounded-xl bg-paper-2 border border-rule flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-[15px] font-semibold text-ink">需要关注</h2>
            {attention.length > 0 && (
              <span className="font-mono text-xs px-1.5 rounded-[5px] bg-status-danger-bg text-status-danger">{attention.length}</span>
            )}
            <button type="button" onClick={() => onSelectTab("notifications")} className="ml-auto text-[13px] text-accent hover:text-accent-hover cursor-pointer">
              告警中心
            </button>
          </div>
          {attention.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1 py-8 text-center">
              <span className="text-sm text-status-online font-medium">一切正常</span>
              <span className="text-xs text-ink-muted">没有离线、熔断、即将到期或超额的节点</span>
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto -mx-1 px-1">
              {attention.slice(0, 8).map((a) => (
                <li key={a.key} className="flex gap-3 py-3 border-t border-rule-subtle first:border-t-0">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${DOT[a.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-ink truncate">{a.title}</div>
                    <div className="text-xs text-ink-muted mt-0.5 line-clamp-2">{a.detail}</div>
                  </div>
                  <button type="button" onClick={a.onAction} className="self-center flex items-center gap-1 text-xs text-accent hover:text-accent-hover cursor-pointer whitespace-nowrap">
                    {a.action}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
