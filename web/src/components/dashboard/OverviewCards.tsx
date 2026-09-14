import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Database,
  Lightning,
  HardDrives,
  ShareNetwork,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react";
import { RollingCounter } from "../common/RollingCounter";

gsap.registerPlugin(useGSAP);

interface OverviewCardsProps {
  totalTrafficUsed: number;
  totalTrafficLimit: number;
  totalUpSpeed: number;
  totalDownSpeed: number;
  onlineCount: number;
  totalCount: number;
  relaysCount: number;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  totalTrafficUsed,
  totalTrafficLimit,
  totalUpSpeed,
  totalDownSpeed,
  onlineCount,
  totalCount,
  relaysCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.from(".telemetry-card", {
      opacity: 0,
      y: 12,
      stagger: 0.06,
      duration: 0.4,
      ease: "power2.out",
    });
  }, { scope: containerRef });

  const formatGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);
  const usedGB = Number(formatGB(totalTrafficUsed));
  const limitGB = Number(formatGB(totalTrafficLimit));
  const trafficPct = limitGB > 0 ? Math.min(100, (usedGB / limitGB) * 100) : 0;

  const formatSpeed = (bytes: number) => {
    if (bytes > 1024 * 1024) return { val: bytes / (1024 * 1024), unit: "MB/s" };
    return { val: bytes / 1024, unit: "KB/s" };
  };

  const up = formatSpeed(totalUpSpeed);
  const down = formatSpeed(totalDownSpeed);

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Traffic Usage */}
      <div className="telemetry-card p-4 rounded-lg bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider">本月流量消耗</span>
            <Database className="w-4 h-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <RollingCounter
              value={usedGB}
              decimals={1}
              className="text-2xl font-bold text-ink"
            />
            <span className="text-xs text-ink-muted font-mono">/ {limitGB} GB</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] font-mono text-ink-muted mb-1">
            <span>配额占比</span>
            <span className={trafficPct > 85 ? "text-status-warning font-semibold" : "text-ink"}>
              {trafficPct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                trafficPct > 90
                  ? "bg-status-danger"
                  : trafficPct > 70
                  ? "bg-status-warning"
                  : "bg-accent"
              }`}
              style={{ width: `${trafficPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 2: Live Speed */}
      <div className="telemetry-card p-4 rounded-lg bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider">实时吞吐带宽</span>
            <Lightning className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
              <RollingCounter
                value={down.val}
                decimals={1}
                suffix={` ${down.unit}`}
                className="text-xl font-bold text-ink"
              />
            </div>
            <div className="flex items-center gap-1 text-ink-muted">
              <ArrowUp className="w-3 h-3 text-sky-400" />
              <RollingCounter
                value={up.val}
                decimals={1}
                suffix={` ${up.unit}`}
                className="text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px] font-mono text-ink-muted">
          <span>采样率</span>
          <span className="text-emerald-400 font-medium">3s 动态上报</span>
        </div>
      </div>

      {/* Card 3: Node Health */}
      <div className="telemetry-card p-4 rounded-lg bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider">在管 VPS 节点</span>
            <HardDrives className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink font-mono">{onlineCount}</span>
            <span className="text-xs text-ink-muted font-mono">/ {totalCount} 台在线</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px] font-mono">
          <span className="text-ink-muted">协议模式</span>
          <span className="text-accent font-semibold">VLESS Reality</span>
        </div>
      </div>

      {/* Card 4: Relay Status */}
      <div className="telemetry-card p-4 rounded-lg bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider">链式解锁代理</span>
            <ShareNetwork className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink font-mono">{relaysCount}</span>
            <span className="text-xs text-ink-muted font-mono">条链式链路</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px] font-mono">
          <span className="text-ink-muted">分流引擎</span>
          <span className="text-purple-400 font-semibold">Xray 智能路由 (AI/流媒体)</span>
        </div>
      </div>
    </div>
  );
};
