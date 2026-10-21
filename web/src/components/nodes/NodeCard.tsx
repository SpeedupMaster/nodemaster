import React from "react";
import {
  Cpu,
  HardDrive,
  Copy,
  Code,
  ArrowClockwise,
  Trash,
  Terminal,
  ArrowUp,
  ArrowDown,
  Check,
  PencilSimple,
  CalendarBlank,
  ShieldCheck,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { NodeItem } from "../../types";
import { Badge } from "../common/Badge";
import { RollingCounter } from "../common/RollingCounter";
import { Tooltip } from "../common/Tooltip";
import { formatSpeed, toGB, formatPct } from "../../utils/format";

interface NodeCardProps {
  node: NodeItem;
  onViewConfig: (node: NodeItem) => void;
  onViewInstall: (node: NodeItem) => void;
  onEdit: (node: NodeItem) => void;
  onResetTraffic: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyUrl: (node: NodeItem) => void;
  onViewVersion?: () => void;
  onSyncConfig?: (node: NodeItem) => void;
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

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  onViewConfig,
  onViewInstall,
  onEdit,
  onResetTraffic,
  onDelete,
  onCopyUrl,
  onViewVersion,
  onSyncConfig,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    onCopyUrl(node);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usedGB = toGB(node.trafficUsedBytes);
  const limitGB = toGB(node.trafficLimitBytes, 0);
  const trafficPct =
    node.trafficLimitBytes > 0
      ? Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100)
      : 0;

  const isProbe = node.type === "probe" || node.protocol === "probe";

  const up = formatSpeed(node.uplinkSpeedBytes);
  const down = formatSpeed(node.downlinkSpeedBytes);

  return (
    <div className="h-full rounded-xl bg-paper-2 border border-rule card-lift p-5 flex flex-col justify-between group">
      <div className="flex-1 flex flex-col">
        {/* Card Header: Node Title & Badges */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0 flex items-center gap-1.5">
            <Tooltip content={node.name}>
              <h4 className="font-semibold text-ink text-sm tracking-tight truncate cursor-default">
                {node.name}
              </h4>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {node.configSyncStatus === "pending" && (
              <Tooltip content="主控配置已更新，VPS 探针正在自动热拉取并平滑重载 Xray (约3秒内生效)...">
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse cursor-help">
                  <ArrowsClockwise className="w-3 h-3 animate-spin" />
                  <span>热同步中</span>
                </span>
              </Tooltip>
            )}
            {node.configSyncStatus === "synced" && (
              <Tooltip content={`配置已全自动热同步至 VPS (${node.configSyncedAt ? new Date(node.configSyncedAt).toLocaleTimeString() : '已生效'})`}>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-help">
                  <CheckCircle className="w-3 h-3" />
                  <span>已热同步</span>
                </span>
              </Tooltip>
            )}
            {node.configSyncStatus === "failed" && (
              <Tooltip content={`热同步异常: ${node.configSyncError || 'Xray 语法校验未通过'}`}>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30 cursor-help">
                  <WarningCircle className="w-3 h-3" />
                  <span>同步异常</span>
                </span>
              </Tooltip>
            )}
            {node.status === "online" && (
              <Badge variant="online" pulse size="sm">
                在线
              </Badge>
            )}
            {node.status === "circuit_broken" && (
              <Badge variant="danger" pulse size="sm">
                已熔断
              </Badge>
            )}
            {node.status === "offline" && (
              <Badge variant="neutral" size="sm">
                离线
              </Badge>
            )}
            <Badge
              variant={isProbe ? "probe" : node.type === "unlock" ? "unlock" : "accent"}
              size="sm"
            >
              {isProbe ? "独立探针" : node.type === "unlock" ? "专属解锁" : "主力直连"}
            </Badge>
          </div>
        </div>

        {/* Location & IP Address Line */}
        <div className="flex items-center gap-1.5 mt-2 text-xs font-mono text-ink-muted">
          <span className="text-ink-secondary font-medium shrink-0">{node.countryName}</span>
          <span className="text-rule shrink-0">•</span>
          <span className="text-ink font-medium shrink-0 select-all font-mono">
            {isProbe || node.port === 0 ? node.ip : `${node.ip}:${node.port}`}
          </span>
        </div>

        {/* Specs & Core Metadata Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {node.bandwidthMbps && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              {node.bandwidthMbps >= 1000 ? `${node.bandwidthMbps / 1000} Gbps` : `${node.bandwidthMbps} Mbps`}
            </span>
          )}

          {node.tcpCongestion && (
            <Tooltip
              content={`TCP 拥塞算法: ${node.tcpCongestion.toUpperCase()} (${
                node.tcpCongestion.toLowerCase() === "bbr" ? "已开启 BBR 硬件级跨境加速" : "系统默认"
              })`}
            >
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border cursor-help ${
                  node.tcpCongestion.toLowerCase() === "bbr"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                    : "text-ink-muted bg-paper-3 border-rule"
                }`}
              >
                {node.tcpCongestion.toUpperCase()}
              </span>
            </Tooltip>
          )}

          {!isProbe && node.xrayVersion && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-purple-300 bg-purple-500/10 border border-purple-500/25">
              Xray {node.xrayVersion}
            </span>
          )}

          {node.costAmount != null && node.costAmount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25">
              <span>{node.costCurrency === "USD" ? "$" : node.costCurrency === "EUR" ? "€" : "¥"}{node.costAmount}</span>
              <span className="text-amber-400/70 text-[9px] ml-0.5">
                {node.costPeriod === "annually" ? "/年" : node.costPeriod === "quarterly" ? "/季" : "/月"}
              </span>
            </span>
          )}

          {node.expiresAt && (() => {
            const info = getExpiryInfo(node.expiresAt);
            const isExp = info?.isExpired;
            const isSoon = info?.isExpiringSoon;
            return (
              <Tooltip
                content={`到期时间: ${node.expiresAt} (${
                  isExp ? "已到期" : `剩余 ${info?.diffDays} 天`
                })${node.autoRenew ? " · 已开启自动续费" : " · 手动续费"}`}
              >
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border cursor-help ${
                    isExp
                      ? "text-rose-400 bg-rose-500/10 border-rose-500/30 font-semibold"
                      : isSoon
                      ? "text-amber-300 bg-amber-500/10 border-amber-500/30 font-semibold"
                      : "text-ink-secondary bg-paper-3 border-rule"
                  }`}
                >
                  <CalendarBlank className="w-3 h-3 shrink-0" />
                  <span>{isExp ? "已到期" : `${info?.diffDays}天到期`}</span>
                </span>
              </Tooltip>
            );
          })()}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1 mt-2.5 min-h-[22px]">
          {node.tags?.map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-mono"
            >
              {t}
            </span>
          ))}
          {node.autoRenew && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1"
              title="此节点已开启自动续费"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              自动续费
            </span>
          )}
        </div>

        {/* Real-time Speeds & Latency */}
        <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 rounded bg-paper/60 border border-rule-subtle">
          <div>
            <div className="text-[10px] text-ink-muted flex items-center gap-0.5 font-mono">
              <ArrowUp className="w-2.5 h-2.5 text-sky-400" />
              <span>上行</span>
            </div>
            <div className="text-xs font-mono font-semibold text-ink mt-0.5">
              <RollingCounter value={up.val} decimals={1} suffix={` ${up.unit}`} />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-ink-muted flex items-center gap-0.5 font-mono">
              <ArrowDown className="w-2.5 h-2.5 text-emerald-400" />
              <span>下行</span>
            </div>
            <div className="text-xs font-mono font-semibold text-ink mt-0.5">
              <RollingCounter value={down.val} decimals={1} suffix={` ${down.unit}`} />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-ink-muted font-mono">网络延迟</div>
            <div className="text-xs font-mono font-semibold text-accent mt-0.5">
              {node.latencyMs} ms
            </div>
          </div>
        </div>

        {/* System Load: CPU / RAM */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <div className="flex justify-between text-[11px] font-mono text-ink-muted mb-0.5">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-ink-muted" /> CPU
              </span>
              <span className="text-ink">{formatPct(node.cpuUsage)}%</span>
            </div>
            <div className="w-full h-1 rounded-full bg-paper-3 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  node.cpuUsage > 80 ? "bg-status-danger" : "bg-sky-500"
                }`}
                style={{ width: `${node.cpuUsage}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-ink-muted mb-0.5">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-ink-muted" /> 内存
              </span>
              <span className="text-ink">{formatPct(node.memUsage)}%</span>
            </div>
            <div className="w-full h-1 rounded-full bg-paper-3 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  node.memUsage > 85 ? "bg-status-danger" : "bg-purple-500"
                }`}
                style={{ width: `${node.memUsage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Traffic Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-[11px] font-mono text-ink-muted mb-1">
            <span>
              当月流量消耗
              <span className="text-ink-muted/70 text-[10px] ml-1">
                (每月{node.trafficResetDay || 1}日重置)
              </span>
            </span>
            <span className={trafficPct > 90 ? "text-status-danger font-semibold" : "text-ink"}>
              {usedGB} / {limitGB} GB ({trafficPct.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                trafficPct > 95
                  ? "bg-status-danger"
                  : trafficPct > 80
                  ? "bg-status-warning"
                  : "bg-accent"
              }`}
              style={{ width: `${trafficPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Actions */}
      <div className="mt-5 pt-3 border-t border-rule flex items-center justify-between text-xs gap-1.5">
        <div className="flex items-center gap-1 shrink-0">
          {!isProbe && (
            <Tooltip content={node.protocol === "shadowsocks" ? "复制 Shadowsocks 链接" : "复制客户端 VLESS 链接"}>
              <button
                onClick={handleCopy}
                className="px-2 py-1.5 rounded text-ink-secondary hover:text-ink hover:bg-paper-hover border border-rule transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span className="text-[11px] font-mono">链接</span>
              </button>
            </Tooltip>
          )}

          {!isProbe && (
            <Tooltip content="查看 Xray 服务端配置">
              <button
                onClick={() => onViewConfig(node)}
                className="px-2 py-1.5 rounded text-ink-secondary hover:text-ink hover:bg-paper-hover border border-rule transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Code className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono">配置</span>
              </button>
            </Tooltip>
          )}

          <Tooltip content="一键部署命令">
            <button
              onClick={() => onViewInstall(node)}
              className="px-2 py-1.5 rounded text-ink-secondary hover:text-ink hover:bg-paper-hover border border-rule transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Terminal className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-mono">命令</span>
            </button>
          </Tooltip>

          {onViewVersion && !isProbe && (
            <Tooltip content={`检测与更新 Xray 内核 (当前: ${node.xrayVersion || "尚未上报"})`}>
              <button
                onClick={onViewVersion}
                className="px-2 py-1.5 rounded text-ink-secondary hover:text-purple-400 hover:bg-purple-500/10 border border-rule transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] font-mono">内核</span>
              </button>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <Tooltip content="编辑节点配置">
            <button
              onClick={() => onEdit(node)}
              className="p-1.5 rounded text-ink-muted hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer shrink-0"
            >
              <PencilSimple className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="重置当月流量统计">
            <button
              onClick={() => onResetTraffic(node.id)}
              className="p-1.5 rounded text-ink-muted hover:text-ink-secondary hover:bg-paper-hover transition-colors cursor-pointer shrink-0"
            >
              <ArrowClockwise className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {onSyncConfig && !isProbe && (
            <Tooltip content="一键热重载：立即同步最新配置至 VPS (无需登录 SSH)">
              <button
                onClick={() => onSyncConfig(node)}
                className="p-1.5 rounded text-ink-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer shrink-0"
              >
                <ArrowsClockwise className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}

          <Tooltip content="删除节点">
            <button
              onClick={() => onDelete(node.id)}
              className="p-1.5 rounded text-ink-muted hover:text-status-danger hover:bg-status-danger-bg transition-colors cursor-pointer shrink-0"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
