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
    <div ref={containerRef} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Card 1: Traffic Usage (Full width on mobile, 1 col on desktop) */}
      <div className="telemetry-card col-span-2 lg:col-span-1 p-3.5 sm:p-4 rounded-lg bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider truncate">本月流量消耗</span>
            <Database className="w-4 h-4 text-accent shrink-0 ml-1" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <RollingCounter
              value={usedGB}
              decimals={1}
              className="text-xl sm:text-2xl font-bold text-ink"
            />
            <span className="text-xs text-ink-muted font-mono truncate">/ {limitGB} GB</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] font-mono text-ink-muted mb-1">
            <span className="truncate">配额占比</span>
            <span className={trafficPct > 85 ? "text-status-danger font-semibold" : "text-ink"}>
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

      {/* Card 2: Live Speed (Half width on mobile) */}
      <div className="telemetry-card col-span-1 lg:col-span-1 p-3.5 sm:p-4 rounded-lg bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider truncate">实时吞吐带宽</span>
            <Lightning className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
          </div>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <RollingCounter
                value={down.val}
                decimals={1}
                suffix={` ${down.unit}`}
                className="text-base sm:text-xl font-bold text-ink truncate"
              />
            </div>
            <div className="flex items-center gap-1 text-ink-muted min-w-0">
              <ArrowUp className="w-3 h-3 text-sky-400 shrink-0" />
              <RollingCounter
                value={up.val}
                decimals={1}
                suffix={` ${up.unit}`}
                className="text-xs font-mono truncate"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px] font-mono text-ink-muted">
          <span className="truncate">采样率</span>
          <span className="text-emerald-400 font-medium whitespace-nowrap">3s 动态</span>
        </div>
      </div>

      {/* Card 3: Node Health (Half width on mobile) */}
      <div className="telemetry-card col-span-1 lg:col-span-1 p-3.5 sm:p-4 rounded-lg bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider truncate">在管 VPS 节点</span>
            <HardDrives className="w-4 h-4 text-purple-400 shrink-0 ml-1" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-ink font-mono">{onlineCount}</span>
            <span className="text-xs text-ink-muted font-mono truncate">/ {totalCount} 在线</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px] font-mono">
          <span className="text-ink-muted truncate">协议模式</span>
          <span className="text-accent font-semibold whitespace-nowrap">Reality</span>
        </div>
      </div>

      {/* Card 4: Relay Status (Full width on mobile, 1 col on desktop) */}
      <div className="telemetry-card col-span-2 sm:col-span-1 lg:col-span-1 p-3.5 sm:p-4 rounded-lg bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-mono uppercase tracking-wider truncate">链式解锁代理</span>
            <ShareNetwork className="w-4 h-4 text-purple-400 shrink-0 ml-1" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-ink font-mono">{relaysCount}</span>
            <span className="text-xs text-ink-muted font-mono truncate">条链式链路</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px] font-mono">
          <span className="text-ink-muted truncate">分流引擎</span>
          <span className="text-purple-400 font-semibold truncate ml-1">Xray 智能路由</span>
        </div>
      </div>
    </div>
  );
};
