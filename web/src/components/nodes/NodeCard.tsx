import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Check,
  Code,
  DotsThree,
  Terminal,
  PencilSimple,
  ArrowsClockwise,
  ArrowClockwise,
  ShieldCheck,
  Cpu,
  Trash,
} from "@phosphor-icons/react";
import { NodeItem } from "../../types";
import { RollingCounter } from "../common/RollingCounter";
import { Tooltip } from "../common/Tooltip";
import { formatSpeed, toGB, formatPct } from "../../utils/format";

interface NodeCardProps {
  node: NodeItem;
  onOpen?: (node: NodeItem) => void;
  onViewConfig: (node: NodeItem) => void;
  onViewInstall: (node: NodeItem) => void;
  onEdit: (node: NodeItem) => void;
  onResetTraffic: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyUrl: (node: NodeItem) => void;
  onViewVersion?: () => void;
  onViewProbeVersion?: () => void;
  onSyncConfig?: (node: NodeItem) => void;
}

export const getExpiryDays = (expiresAt?: string | null): number | null => {
  if (!expiresAt) return null;
  const target = new Date(expiresAt + "T23:59:59");
  if (isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
};

export const STATUS_META: Record<NodeItem["status"], { label: string; chip: string; dot: string }> = {
  online: { label: "在线", chip: "bg-status-online-bg text-status-online", dot: "bg-status-online" },
  offline: { label: "离线", chip: "bg-paper-3 text-ink-muted", dot: "bg-ink-muted" },
  circuit_broken: { label: "已熔断", chip: "bg-status-danger-bg text-status-danger", dot: "bg-status-danger" },
};

export const roleMeta = (node: NodeItem) => {
  if (node.type === "probe" || node.protocol === "probe") return { label: "仅探针", chip: "bg-paper-3 text-ink-secondary" };
  if (node.type === "unlock") return { label: "解锁落地", chip: "bg-violet-500/15 text-violet-600 dark:text-[#A58BFA]" };
  return { label: "主力直连", chip: "bg-accent-subtle text-accent" };
};

const CURRENCY: Record<string, string> = { USD: "$", EUR: "€", CNY: "¥" };
const PERIOD: Record<string, string> = { monthly: "月", quarterly: "季", annually: "年" };

export const billingText = (node: NodeItem) => {
  const parts: string[] = [];
  if (node.costAmount && node.costAmount > 0) {
    parts.push(`${CURRENCY[node.costCurrency || "CNY"] ?? "¥"}${node.costAmount}/${PERIOD[node.costPeriod || "monthly"] ?? "月"}`);
  }
  const days = getExpiryDays(node.expiresAt);
  if (days !== null) parts.push(days <= 0 ? "已到期" : `${days} 天后到期`);
  if (node.autoRenew) parts.push("自动续费");
  return { text: parts.join(" · ") || "未设置账单", days };
};

const latencyColor = (ms: number) =>
  ms <= 0 ? "text-ink-muted" : ms < 80 ? "text-status-online" : ms < 180 ? "text-status-warning" : "text-status-danger";

const chip = "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-xs font-medium whitespace-nowrap";
const footBtn =
  "h-[30px] px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-rule bg-paper-3 text-[12.5px] font-medium text-ink-secondary hover:text-ink hover:border-rule-active transition-colors cursor-pointer";

type MenuItem = { label: string; icon: React.ElementType; onClick: () => void; danger?: boolean; hidden?: boolean };

const MoreMenu: React.FC<{ items: MenuItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="更多操作"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${footBtn} w-[30px] px-0 justify-center`}
      >
        <DotsThree weight="bold" className="w-4 h-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-[70] min-w-[188px] p-1 rounded-[10px] border border-rule bg-paper-2 shadow-pop animate-pop-in"
          >
            {items
              .filter((it) => !it.hidden)
              .map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                  className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[13px] text-left cursor-pointer transition-colors ${
                    it.danger ? "text-status-danger hover:bg-status-danger-bg" : "text-ink-secondary hover:text-ink hover:bg-paper-3"
                  }`}
                >
                  <it.icon className="w-4 h-4 shrink-0" />
                  {it.label}
                </button>
              ))}
          </div>,
          document.body
        )}
    </>
  );
};

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  onOpen,
  onViewConfig,
  onViewInstall,
  onEdit,
  onResetTraffic,
  onDelete,
  onCopyUrl,
  onViewVersion,
  onViewProbeVersion,
  onSyncConfig,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyUrl(node);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isProbe = node.type === "probe" || node.protocol === "probe";
  const status = STATUS_META[node.status];
  const role = roleMeta(node);
  const bill = billingText(node);

  const trafficPct =
    node.trafficLimitBytes > 0 ? Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100) : 0;
  const quota =
    trafficPct >= 95
      ? { text: "text-status-danger", bar: "bg-status-danger" }
      : trafficPct >= 80
      ? { text: "text-status-warning", bar: "bg-status-warning" }
      : { text: "text-ink", bar: "bg-accent" };

  const up = formatSpeed(node.uplinkSpeedBytes);
  const down = formatSpeed(node.downlinkSpeedBytes);

  const bandwidth = node.bandwidthMbps
    ? node.bandwidthMbps >= 1000
      ? `${node.bandwidthMbps / 1000} Gbps`
      : `${node.bandwidthMbps} Mbps`
    : null;
  const proto = isProbe ? null : node.protocol === "shadowsocks" ? "SS" : "Reality";

  const borderTone =
    node.status === "circuit_broken"
      ? "border-status-danger/40"
      : bill.days !== null && bill.days <= 7
      ? "border-status-warning/40"
      : "border-rule";

  return (
    <article className={`h-full flex flex-col rounded-xl bg-paper-2 border ${borderTone} transition-colors hover:border-rule-active`}>
      <div className="px-4 pt-4 flex flex-col gap-2.5">
        <div className="flex items-start gap-2.5">
          <span className="w-[30px] h-[22px] mt-px rounded-[5px] bg-paper-3 text-ink-secondary font-mono text-[11px] flex items-center justify-center shrink-0">
            {node.country || "--"}
          </span>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onOpen?.(node)}
              title={node.name}
              className="text-left text-[14.5px] font-semibold text-ink truncate hover:text-accent transition-colors cursor-pointer"
            >
              {node.name}
            </button>
            <span className="font-mono text-[11.5px] text-ink-muted select-all truncate">
              {isProbe || node.port === 0 ? node.ip : `${node.ip}:${node.port}`}
              {node.countryName && <span className="font-sans"> · {node.countryName}</span>}
            </span>
          </div>
          <span className={`${chip} shrink-0 ${status.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`${chip} ${role.chip}`}>{role.label}</span>
          {proto && <span className={`${chip} bg-paper-3 text-ink-secondary font-mono`}>{proto}</span>}
          {bandwidth && <span className={`${chip} bg-paper-3 text-ink-secondary font-mono`}>{bandwidth}</span>}
          {node.tags?.slice(0, 3).map((t) => (
            <span key={t} className={`${chip} bg-paper-3 text-ink-secondary`}>
              {t}
            </span>
          ))}
          {node.configSyncStatus === "pending" && (
            <Tooltip content="主控配置已更新，VPS 探针正在热拉取并平滑重载 Xray（约 3 秒内生效）">
              <span className={`${chip} bg-status-warning-bg text-status-warning cursor-help`}>
                <ArrowsClockwise className="w-3 h-3 animate-spin" />
                同步中
              </span>
            </Tooltip>
          )}
          {node.configSyncStatus === "failed" && (
            <Tooltip content={`热同步失败：${node.configSyncError || "Xray 配置校验未通过"}`}>
              <span className={`${chip} bg-status-danger-bg text-status-danger cursor-help`}>同步失败</span>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="mx-4 mt-3.5 p-3 rounded-lg bg-paper grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11.5px] text-ink-muted">下行</span>
          <span className="font-mono text-sm text-ink">
            <RollingCounter value={down.val} decimals={1} suffix={` ${down.unit}`} />
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11.5px] text-ink-muted">上行</span>
          <span className="font-mono text-sm text-ink">
            <RollingCounter value={up.val} decimals={1} suffix={` ${up.unit}`} />
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11.5px] text-ink-muted">延迟</span>
          <span className={`font-mono text-sm ${latencyColor(node.latencyMs)}`}>
            {node.latencyMs > 0 ? `${node.latencyMs} ms` : "—"}
          </span>
        </div>
      </div>

      <div className="px-4 py-3.5 flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-3.5">
          {[
            { label: "CPU", v: node.cpuUsage, bar: node.cpuUsage > 85 ? "bg-status-danger" : "bg-accent" },
            { label: "内存", v: node.memUsage, bar: node.memUsage > 90 ? "bg-status-danger" : "bg-violet-500 dark:bg-[#A58BFA]" },
          ].map((m) => (
            <div key={m.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-ink-muted">{m.label}</span>
                <span className="font-mono text-ink">{formatPct(m.v)}%</span>
              </div>
              <div className="h-1 rounded-sm bg-paper-3 overflow-hidden">
                <div className={`h-full ${m.bar}`} style={{ width: `${Math.min(100, m.v)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-ink-muted">
              本月流量 <span className="text-[11px]">· {node.trafficResetDay || 1} 日重置</span>
            </span>
            <span className={`font-mono ${quota.text}`}>
              {toGB(node.trafficUsedBytes)} / {node.trafficLimitBytes > 0 ? `${toGB(node.trafficLimitBytes, 0)} GB` : "不限"}
            </span>
          </div>
          <div className="h-1 rounded-sm bg-paper-3 overflow-hidden">
            <div className={`h-full ${quota.bar} transition-[width] duration-300`} style={{ width: `${trafficPct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-auto pl-4 pr-3 py-2.5 border-t border-rule-subtle flex items-center gap-1.5">
        <span className={`flex-1 min-w-0 truncate text-xs ${bill.days !== null && bill.days <= 7 ? "text-status-warning" : "text-ink-muted"}`}>
          {bill.text}
        </span>
        {!isProbe && (
          <button type="button" onClick={handleCopy} className={footBtn}>
            {copied ? <Check className="w-3.5 h-3.5 text-status-online" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "已复制" : "复制链接"}
          </button>
        )}
        {!isProbe && (
          <button type="button" onClick={() => onViewConfig(node)} className={footBtn}>
            <Code className="w-3.5 h-3.5" />
            配置
          </button>
        )}
        <MoreMenu
          items={[
            { label: "编辑节点", icon: PencilSimple, onClick: () => onEdit(node) },
            { label: "部署命令", icon: Terminal, onClick: () => onViewInstall(node) },
            { label: "立即同步配置", icon: ArrowsClockwise, onClick: () => onSyncConfig?.(node), hidden: !onSyncConfig || isProbe },
            { label: node.xrayVersion ? `Xray 内核 (${node.xrayVersion})` : "Xray 内核", icon: ShieldCheck, onClick: () => onViewVersion?.(), hidden: !onViewVersion || isProbe },
            { label: node.probeVersion ? `系统探针 (${node.probeVersion})` : "系统探针", icon: Cpu, onClick: () => onViewProbeVersion?.(), hidden: !onViewProbeVersion },
            { label: "重置本月流量", icon: ArrowClockwise, onClick: () => onResetTraffic(node.id) },
            { label: "删除节点", icon: Trash, onClick: () => onDelete(node.id), danger: true },
          ]}
        />
      </div>
    </article>
  );
};
