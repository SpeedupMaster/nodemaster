import React, { useState } from "react";
import { ArrowLeft, Copy, Check, Terminal, PencilSimple, Code, ArrowsClockwise } from "@phosphor-icons/react";
import type { NodeInput, NodeItem, RelayLink } from "../../types";
import { NodeDetailModal } from "./NodeDetailModal";
import { InstallModal } from "../nodes/InstallModal";
import { ConfigModal } from "../nodes/ConfigModal";
import { NodeForm } from "../nodes/NodeForm";
import { STATUS_META, roleMeta, getExpiryDays } from "../nodes/NodeCard";
import { buildNodeShareUrl } from "../../utils/nodeLink";
import { formatBytes, formatPct, formatSpeed, formatUptime } from "../../utils/format";
import { api } from "../../services/api";

interface NodeDetailPageProps {
  node: NodeItem;
  nodes: NodeItem[];
  relays: RelayLink[];
  onBack: () => void;
  onOpenNode: (node: NodeItem) => void;
  onUpdate: (id: string, input: NodeInput) => Promise<unknown>;
  onSelectTab: (tab: string) => void;
}

const btn =
  "h-9 px-3 inline-flex items-center gap-2 rounded-lg border border-rule bg-paper-2 text-[13px] font-medium text-ink hover:border-rule-active cursor-pointer transition-colors";
const chip = "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-xs font-medium whitespace-nowrap";

const CURRENCY: Record<string, string> = { USD: "$", EUR: "€", CNY: "¥" };
const PERIOD: Record<string, string> = { monthly: "月", quarterly: "季", annually: "年" };
const RELAY_MODE: Record<string, string> = { ai_media: "AI 与流媒体", all: "全部流量", custom: "自定义规则" };

const tone = (pct: number, warn = 80, danger = 90) =>
  pct >= danger ? "bg-status-danger" : pct >= warn ? "bg-status-warning" : "bg-accent";

const Kv: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-t border-rule-subtle first:border-0 text-[13px]">
    <span className="text-ink-muted shrink-0">{k}</span>
    <span className="text-ink text-right min-w-0 break-words">{children}</span>
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <section className="p-4 sm:p-5 rounded-xl bg-paper-2 border border-rule flex flex-col gap-2">
    <div className="flex items-center gap-2 mb-1">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {action && <div className="ml-auto">{action}</div>}
    </div>
    {children}
  </section>
);

/** Full-page view of a single node: header, live resources, history charts and metadata */
export const NodeDetailPage: React.FC<NodeDetailPageProps> = ({ node, nodes, relays, onBack, onOpenNode, onUpdate, onSelectTab }) => {
  const [copied, setCopied] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isProbe = node.type === "probe" || node.protocol === "probe";
  const status = STATUS_META[node.status];
  const role = roleMeta(node);
  const shareUrl = buildNodeShareUrl(node);
  const down = formatSpeed(node.downlinkSpeedBytes);
  const up = formatSpeed(node.uplinkSpeedBytes);
  const quotaPct = node.trafficLimitBytes > 0 ? Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100) : 0;
  const expiryDays = getExpiryDays(node.expiresAt);

  const asEntry = relays.filter((r) => r.mainNodeId === node.id);
  const asExit = relays.filter((r) => r.unlockNodeId === node.id);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const syncConfig = async () => {
    setSyncing(true);
    try {
      await api("POST", `/api/nodes/${node.id}/sync`);
    } catch (e) {
      console.error("触发节点配置同步失败:", e);
    } finally {
      setSyncing(false);
    }
  };

  const meta = [
    isProbe || node.port === 0 ? node.ip : `${node.ip}:${node.port}`,
    [node.os, node.arch].filter(Boolean).join(" · ") || null,
    isProbe ? null : node.protocol === "shadowsocks" ? "Shadowsocks" : "VLESS-Reality",
    node.tcpCongestion ? node.tcpCongestion.toUpperCase() : null,
    node.bandwidthMbps ? (node.bandwidthMbps >= 1000 ? `${node.bandwidthMbps / 1000} Gbps` : `${node.bandwidthMbps} Mbps`) : null,
    node.uptime ? `运行 ${formatUptime(node.uptime)}` : null,
  ].filter(Boolean) as string[];

  const resources = [
    {
      label: "CPU",
      value: `${formatPct(node.cpuUsage)}%`,
      pct: node.cpuUsage,
      bar: tone(node.cpuUsage, 70, 85),
      sub: node.loadAvg ? `负载 ${node.loadAvg.map((v) => v.toFixed(2)).join(" / ")}` : "—",
    },
    {
      label: "内存",
      value: `${formatPct(node.memUsage)}%`,
      pct: node.memUsage,
      bar: tone(node.memUsage, 80, 90),
      sub: node.memTotalBytes ? `${formatBytes(node.memUsedBytes)} / ${formatBytes(node.memTotalBytes)}` : "—",
    },
    {
      label: "磁盘",
      value: `${formatPct(node.diskUsage)}%`,
      pct: node.diskUsage,
      bar: tone(node.diskUsage, 80, 90),
      sub: node.diskTotalBytes ? `${formatBytes(node.diskUsedBytes)} / ${formatBytes(node.diskTotalBytes)}` : "—",
    },
    {
      label: "本月流量",
      value: `${quotaPct.toFixed(1)}%`,
      pct: quotaPct,
      bar: tone(quotaPct, 80, 95),
      sub: `${formatBytes(node.trafficUsedBytes)} / ${node.trafficLimitBytes > 0 ? formatBytes(node.trafficLimitBytes, 0) : "不限"}`,
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4">
        <nav aria-label="面包屑" className="flex items-center gap-2 text-[13px] text-ink-muted">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 hover:text-ink cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" />
            节点
          </button>
          <span aria-hidden="true">/</span>
          <span className="text-ink-secondary truncate">{node.name}</span>
        </nav>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1 basis-[420px]">
            <span className="w-9 h-7 mt-0.5 rounded-md bg-paper-3 text-ink-secondary font-mono text-xs flex items-center justify-center shrink-0">
              {node.country || "--"}
            </span>
            <div className="min-w-0 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-[22px] font-bold text-ink break-all">{node.name}</h2>
                <span className={`${chip} ${status.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
                <span className={`${chip} ${role.chip}`}>{role.label}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-ink-muted">
                {meta.map((m, i) => (
                  <span key={i} className={i === 0 ? "select-all text-ink-secondary" : ""}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {shareUrl && (
              <button type="button" onClick={copyLink} className={btn}>
                {copied ? <Check weight="bold" className="w-4 h-4 text-status-online" /> : <Copy className="w-4 h-4" />}
                {copied ? "已复制" : "复制节点链接"}
              </button>
            )}
            {!isProbe && (
              <button type="button" onClick={() => setShowConfig(true)} className={btn}>
                <Code className="w-4 h-4" />
                配置
              </button>
            )}
            <button type="button" onClick={() => setShowInstall(true)} className={btn}>
              <Terminal className="w-4 h-4" />
              部署命令
            </button>
            <button type="button" onClick={() => setShowEdit(true)} className={btn}>
              <PencilSimple className="w-4 h-4" />
              编辑
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {resources.map((r) => (
              <div key={r.label} className="p-4 rounded-xl bg-paper-2 border border-rule flex flex-col gap-2 min-w-0">
                <span className="text-[13px] text-ink-secondary">{r.label}</span>
                <span className="font-mono text-[22px] leading-none text-ink">{r.value}</span>
                <div className="h-1 rounded-sm bg-paper-3 overflow-hidden">
                  <div className={`h-full ${r.bar}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                </div>
                <span className="font-mono text-xs text-ink-muted truncate">{r.sub}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-paper-2 border border-rule">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">实时下行</span>
              <span className="font-mono text-base text-ink">
                {down.val.toFixed(1)} <span className="text-xs text-ink-muted">{down.unit}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">实时上行</span>
              <span className="font-mono text-base text-ink">
                {up.val.toFixed(1)} <span className="text-xs text-ink-muted">{up.unit}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">连接数</span>
              <span className="font-mono text-base text-ink">
                {node.tcpCount ?? "—"} <span className="text-xs text-ink-muted">TCP</span> · {node.udpCount ?? "—"}{" "}
                <span className="text-xs text-ink-muted">UDP</span>
              </span>
            </div>
          </div>

          <NodeDetailModal node={node} isOpen onClose={onBack} embedded />
        </div>

        <aside className="flex flex-col gap-3 min-w-0">
          <Card title="账单与到期">
            <div className="flex flex-col">
              <Kv k="费用">
                <span className="font-mono">
                  {node.costAmount && node.costAmount > 0
                    ? `${CURRENCY[node.costCurrency || "CNY"] ?? "¥"}${node.costAmount} / ${PERIOD[node.costPeriod || "monthly"] ?? "月"}`
                    : "未设置"}
                </span>
              </Kv>
              <Kv k="到期日">
                {node.expiresAt ? (
                  <span className={`font-mono ${expiryDays !== null && expiryDays <= 7 ? "text-status-warning" : ""}`}>
                    {node.expiresAt}（{expiryDays !== null && expiryDays <= 0 ? "已到期" : `剩 ${expiryDays} 天`}）
                  </span>
                ) : (
                  "未设置"
                )}
              </Kv>
              <Kv k="自动续费">{node.autoRenew ? "已开启" : "未开启"}</Kv>
              <Kv k="流量重置">每月 {node.trafficResetDay || 1} 日</Kv>
            </div>
          </Card>

          {!isProbe && (
            <Card
              title="链式出口"
              action={
                <button type="button" onClick={() => onSelectTab("topology")} className="text-[13px] text-accent hover:underline cursor-pointer">
                  在拓扑中编辑
                </button>
              }
            >
              {asEntry.length === 0 && asExit.length === 0 && (
                <p className="text-[13px] text-ink-muted">未参与链式代理，全部流量由本机直连出站。</p>
              )}
              {asEntry.map((r) => {
                const exit = nodeById.get(r.unlockNodeId);
                return (
                  <div key={r.id} className="flex flex-col gap-1.5 p-3 rounded-lg bg-paper text-[13px]">
                    <span className="text-xs text-ink-muted">
                      {r.name} · 匹配{RELAY_MODE[r.mode || "ai_media"] ?? "规则"}
                      {r.status !== "active" && <span className="text-status-warning"> · 已停用</span>}
                    </span>
                    {exit ? (
                      <button type="button" onClick={() => onOpenNode(exit)} className="flex items-center gap-2 text-left text-ink hover:text-accent cursor-pointer">
                        <span className="font-mono text-[11px] text-ink-muted">{exit.country}</span>
                        <span className="truncate">→ {exit.name}</span>
                      </button>
                    ) : (
                      <span className="text-ink-muted">出口节点已删除</span>
                    )}
                  </div>
                );
              })}
              {asExit.length > 0 && (
                <p className="text-[13px] text-ink-secondary">
                  作为解锁落地，承接 {asExit.length} 个入口节点的分流：
                  {asExit.map((r) => nodeById.get(r.mainNodeId)?.name ?? "已删除").join("、")}
                </p>
              )}
            </Card>
          )}

          <Card
            title="组件版本"
            action={
              !isProbe && (
                <button
                  type="button"
                  onClick={syncConfig}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline cursor-pointer disabled:opacity-60"
                >
                  <ArrowsClockwise className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                  同步配置
                </button>
              )
            }
          >
            <div className="flex flex-col">
              {!isProbe && <Kv k="Xray 内核"><span className="font-mono">{node.xrayVersion || "未上报"}</span></Kv>}
              <Kv k="系统探针"><span className="font-mono">{node.probeVersion || "未上报"}</span></Kv>
              {!isProbe && (
                <Kv k="配置同步">
                  {node.configSyncStatus === "failed" ? (
                    <span className="text-status-danger" title={node.configSyncError}>
                      失败
                    </span>
                  ) : node.configSyncStatus === "pending" ? (
                    <span className="text-status-warning">同步中</span>
                  ) : (
                    <span className="text-status-online">已同步</span>
                  )}
                </Kv>
              )}
              <Kv k="TCP 拥塞控制"><span className="font-mono">{node.tcpCongestion?.toUpperCase() || "—"}</span></Kv>
            </div>
          </Card>

          <Card title="系统">
            <div className="flex flex-col">
              <Kv k="最后心跳">{node.lastSeen ? new Date(node.lastSeen).toLocaleString() : "从未上报"}</Kv>
              <Kv k="接入时间">{node.createdAt ? new Date(node.createdAt).toLocaleDateString() : "—"}</Kv>
              {node.tags?.length > 0 && <Kv k="标签">{node.tags.join("、")}</Kv>}
            </div>
          </Card>
        </aside>
      </div>

      <InstallModal node={showInstall ? node : null} onClose={() => setShowInstall(false)} />
      <ConfigModal node={showConfig ? node : null} onClose={() => setShowConfig(false)} />
      <NodeForm node={node} isOpen={showEdit} onClose={() => setShowEdit(false)} onSubmit={(input) => onUpdate(node.id, input)} />
    </div>
  );
};
