import React from "react";
import {
  Cpu,
  HardDrive,
  Copy,
  Code,
  ArrowClockwise,
  Trash,
  Globe,
  Terminal,
  ArrowUp,
  ArrowDown,
  Check,
  PencilSimple,
} from "@phosphor-icons/react";
import { NodeItem } from "../../types";
import { Badge } from "../common/Badge";
import { RollingCounter } from "../common/RollingCounter";

interface NodeCardProps {
  node: NodeItem;
  onViewConfig: (node: NodeItem) => void;
  onViewInstall: (node: NodeItem) => void;
  onEdit: (node: NodeItem) => void;
  onResetTraffic: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyUrl: (node: NodeItem) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  onViewConfig,
  onViewInstall,
  onEdit,
  onResetTraffic,
  onDelete,
  onCopyUrl,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    onCopyUrl(node);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usedGB = (node.trafficUsedBytes / (1024 * 1024 * 1024)).toFixed(1);
  const limitGB = (node.trafficLimitBytes / (1024 * 1024 * 1024)).toFixed(0);
  const trafficPct =
    node.trafficLimitBytes > 0
      ? Math.min(100, (node.trafficUsedBytes / node.trafficLimitBytes) * 100)
      : 0;

  const formatSpeed = (bytes: number) => {
    if (bytes > 1024 * 1024) return { val: bytes / (1024 * 1024), unit: "MB/s" };
    return { val: bytes / 1024, unit: "KB/s" };
  };

  const up = formatSpeed(node.uplinkSpeedBytes);
  const down = formatSpeed(node.downlinkSpeedBytes);

  return (
    <div className="h-full rounded-lg bg-paper-2 border border-rule hover:border-rule-active transition-all p-5 flex flex-col justify-between group">
      <div className="flex-1 flex flex-col justify-between">
        {/* Card Header: Node Title & Badges */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 pr-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h4
                className="font-semibold text-ink text-sm tracking-tight truncate"
                title={node.name}
              >
                {node.name}
              </h4>
            </div>
            <div className="text-xs font-mono text-ink-muted mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-ink-secondary font-medium shrink-0">{node.countryName}</span>
              <span className="shrink-0">•</span>
              <span className="shrink-0">{node.ip}:{node.port}</span>
              <span className="shrink-0">•</span>
              <span
                className={`uppercase text-[11px] font-medium font-mono shrink-0 ${
                  node.protocol === "shadowsocks" ? "text-purple-400" : "text-accent"
                }`}
              >
                {node.protocol === "shadowsocks" ? "Shadowsocks" : node.protocol}
              </span>
              {node.bandwidthMbps && (
                <>
                  <span className="shrink-0">•</span>
                  <span className="text-emerald-400/90 text-[11px] font-medium shrink-0">
                    {node.bandwidthMbps >= 1000
                      ? `${node.bandwidthMbps / 1000} Gbps`
                      : `${node.bandwidthMbps} Mbps`}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
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
              variant={
                node.type === "unlock"
                  ? "exit"
                  : node.type === "direct"
                  ? "accent"
                  : node.type === "transit"
                  ? "transit"
                  : "exit"
              }
              size="sm"
            >
              {node.type === "unlock"
                ? "专属解锁"
                : node.type === "direct"
                ? "主力直连"
                : node.type === "transit"
                ? "中转入口"
                : "海外落地"}
            </Badge>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-3 min-h-[24px]">
          {node.tags?.map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-mono"
            >
              {t}
            </span>
          ))}
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
              <span className="text-ink">{node.cpuUsage}%</span>
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
              <span className="text-ink">{node.memUsage}%</span>
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
      <div className="mt-5 pt-3 border-t border-rule flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded text-ink-secondary hover:text-ink hover:bg-paper-hover border border-rule transition-colors flex items-center gap-1"
            title="复制客户端 VLESS 链接"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px] font-mono">链接</span>
          </button>

          <button
            onClick={() => onViewConfig(node)}
            className="p-1.5 rounded text-ink-secondary hover:text-ink hover:bg-paper-hover border border-rule transition-colors flex items-center gap-1"
            title="查看 Xray 服务端配置"
          >
            <Code className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">配置</span>
          </button>

          <button
            onClick={() => onViewInstall(node)}
            className="p-1.5 rounded text-ink-secondary hover:text-ink hover:bg-paper-hover border border-rule transition-colors flex items-center gap-1"
            title="一键部署命令"
          >
            <Terminal className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] font-mono">命令</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(node)}
            className="p-1.5 rounded text-ink-muted hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
            title="编辑节点配置"
          >
            <PencilSimple className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onResetTraffic(node.id)}
            className="p-1.5 rounded text-ink-muted hover:text-ink-secondary hover:bg-paper-hover transition-colors cursor-pointer"
            title="重置当月流量统计"
          >
            <ArrowClockwise className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(node.id)}
            className="p-1.5 rounded text-ink-muted hover:text-status-danger hover:bg-status-danger-bg transition-colors cursor-pointer"
            title="删除节点"
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
