import React, { useState, useRef, useEffect } from "react";
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
  DotsThreeVertical,
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
  onViewProbeVersion?: () => void;
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
  onViewProbeVersion,
  onSyncConfig,
}) => {
  const [copied, setCopied] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

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
        <div className="flex items-center gap-1.5 mt-2 text-xs text-ink-muted">
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
            <Tooltip content={onViewVersion ? `Xray 内核: ${node.xrayVersion} (点击管理版本)` : `Xray 内核: ${node.xrayVersion}`}>
              {onViewVersion ? (
                <button
                  type="button"
                  onClick={onViewVersion}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-purple-300 bg-purple-500/10 border border-purple-500/25 hover:bg-purple-500/20 hover:border-purple-500/40 transition-colors cursor-pointer"
                >
                  Xray {node.xrayVersion}
                </button>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-purple-300 bg-purple-500/10 border border-purple-500/25">
                  Xray {node.xrayVersion}
                </span>
              )}
            </Tooltip>
          )}

          {node.probeVersion && (
            <Tooltip content={onViewProbeVersion ? `系统探针: ${node.probeVersion} (点击管理版本)` : `系统探针: ${node.probeVersion}`}>
              {onViewProbeVersion ? (
                <button
                  type="button"
                  onClick={onViewProbeVersion}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-colors cursor-pointer"
                >
                  探针 {node.probeVersion}
                </button>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/25">
                  探针 {node.probeVersion}
                </span>
              )}
            </Tooltip>
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
            <div className="flex justify-between text-[11px] text-ink-muted mb-0.5">
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
            <div className="flex justify-between text-[11px] text-ink-muted mb-0.5">
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
          <div className="flex justify-between text-[11px] text-ink-muted mb-1">
            <span>
              当月流量消耗
              <span className="text-ink-muted/70 text-[10px] ml-1">
                (每月{node.trafficResetDay || 1}日重置)
              </span>
            </span>
            <span className={`font-mono ${trafficPct > 90 ? "text-status-danger font-semibold" : "text-ink"}`}>
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
      <div className="mt-5 pt-3 border-t border-rule flex flex-wrap items-center justify-between text-xs gap-y-2 gap-x-1.5">
        <div className="flex items-center gap-1 min-w-0">
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
                <span className="text-[11px] font-medium">链接</span>
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
                <span className="text-[11px] font-medium">配置</span>
              </button>
            </Tooltip>
          )}

          <Tooltip content="一键部署命令">
            <button
              onClick={() => onViewInstall(node)}
              className="px-2 py-1.5 rounded text-ink-secondary hover:text-ink hover:bg-paper-hover border border-rule transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Terminal className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-medium">命令</span>
            </button>
          </Tooltip>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 relative" ref={menuRef}>
          {onSyncConfig && !isProbe && (
            <Tooltip content="一键热重载：立即同步最新配置至 VPS (无需登录 SSH)">
              <button
                onClick={() => onSyncConfig(node)}
                className="p-1.5 rounded text-ink-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer shrink-0"
                aria-label="一键热重载配置"
              >
                <ArrowsClockwise className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}

          <Tooltip content="编辑节点配置">
            <button
              onClick={() => onEdit(node)}
              className="p-1.5 rounded text-ink-muted hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer shrink-0"
              aria-label="编辑节点配置"
            >
              <PencilSimple className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="更多操作" disabled={isMenuOpen}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`p-1.5 rounded transition-colors cursor-pointer shrink-0 ${
                isMenuOpen
                  ? "text-ink bg-paper-hover border border-rule"
                  : "text-ink-muted hover:text-ink hover:bg-paper-hover"
              }`}
              aria-label="更多操作"
              aria-expanded={isMenuOpen}
            >
              <DotsThreeVertical className="w-3.5 h-3.5" weight="bold" />
            </button>
          </Tooltip>

          {isMenuOpen && (
            <div
              className="absolute right-0 bottom-full mb-1.5 w-48 rounded-lg bg-paper-2 border border-rule shadow-2xl py-1 text-xs z-30 select-none"
              role="menu"
            >
              {onViewVersion && !isProbe && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onViewVersion();
                  }}
                  className="w-full px-3 py-2 flex items-center justify-between text-ink-secondary hover:text-purple-300 hover:bg-purple-500/10 transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Xray 内核管理</span>
                  </span>
                  {node.xrayVersion && (
                    <span className="text-[10px] font-mono text-purple-400/80 shrink-0">
                      {node.xrayVersion}
                    </span>
                  )}
                </button>
              )}

              {onViewProbeVersion && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onViewProbeVersion();
                  }}
                  className="w-full px-3 py-2 flex items-center justify-between text-ink-secondary hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>系统探针管理</span>
                  </span>
                  {node.probeVersion && (
                    <span className="text-[10px] font-mono text-emerald-400/80 shrink-0">
                      {node.probeVersion}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onResetTraffic(node.id);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-ink-secondary hover:text-ink hover:bg-paper-hover transition-colors text-left cursor-pointer"
              >
                <ArrowClockwise className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                <span>重置当月流量</span>
              </button>

              <div className="my-1 border-t border-rule" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (window.confirm(`确定要删除节点 "${node.name}" 吗？此操作不可撤销。`)) {
                    onDelete(node.id);
                  }
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
              >
                <Trash className="w-3.5 h-3.5 shrink-0" />
                <span>删除节点</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
