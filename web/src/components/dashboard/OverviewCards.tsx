import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Database,
  Lightning,
  HardDrives,
  Graph,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react";
import { RollingCounter } from "../common/RollingCounter";
import { formatSpeed, toGB } from "../../utils/format";

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
      y: 16,
      scale: 0.98,
      stagger: 0.07,
      duration: 0.6,
      ease: "expo.out",
      clearProps: "transform,translate,scale,opacity",
    });
  }, { scope: containerRef });

  // Feed pointer position to the .card-spotlight sheen
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".card-spotlight");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  const usedGB = Number(toGB(totalTrafficUsed));
  const limitGB = Number(toGB(totalTrafficLimit));
  const trafficPct = limitGB > 0 ? Math.min(100, (usedGB / limitGB) * 100) : 0;

  const up = formatSpeed(totalUpSpeed);
  const down = formatSpeed(totalDownSpeed);

  return (
    <div ref={containerRef} onPointerMove={handlePointerMove} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Card 1: Traffic Usage */}
      <div className="telemetry-card col-span-2 lg:col-span-1 p-3.5 sm:p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between min-w-0 group card-lift card-spotlight">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium tracking-wide truncate">本月流量消耗</span>
            <span className="icon-tile w-8 h-8 shrink-0 ml-1 bg-accent/10 border-accent/25 text-accent">
              <Database weight="duotone" className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
            <RollingCounter
              value={usedGB}
              decimals={1}
              className="text-xl sm:text-2xl font-bold text-ink"
            />
            <span className="text-xs text-ink-muted font-mono truncate">/ {limitGB} GB</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-ink-muted mb-1">
            <span className="truncate">配额占比</span>
            <span className={`font-mono ${trafficPct > 85 ? "text-status-danger font-semibold" : "text-ink"}`}>
              {trafficPct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-paper-3 overflow-hidden">
            <div
              className={`bar-shine h-full transition-[width] duration-700 ease-out-expo rounded-full ${
                trafficPct > 90
                  ? "bg-status-danger"
                  : trafficPct > 70
                  ? "bg-status-warning"
                  : "bg-gradient-accent"
              }`}
              style={{ width: `${trafficPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 2: Live Speed */}
      <div className="telemetry-card col-span-1 lg:col-span-1 p-3.5 sm:p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between min-w-0 group card-lift card-spotlight">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium tracking-wide truncate">实时吞吐带宽</span>
            <span className="icon-tile w-8 h-8 shrink-0 ml-1 bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
              <Lightning weight="duotone" className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <ArrowDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <RollingCounter
                value={down.val}
                decimals={1}
                suffix={` ${down.unit}`}
                className="text-base sm:text-xl font-bold text-ink truncate"
              />
            </div>
            <div className="flex items-center gap-1 text-ink-muted min-w-0">
              <ArrowUp className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
              <RollingCounter
                value={up.val}
                decimals={1}
                suffix={` ${up.unit}`}
                className="text-xs font-mono truncate"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px] text-ink-muted">
          <span className="truncate">采样率</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
            <span className="font-mono">3s</span> 动态
          </span>
        </div>
      </div>

      {/* Card 3: Node Health */}
      <div className="telemetry-card col-span-1 lg:col-span-1 p-3.5 sm:p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between min-w-0 group card-lift card-spotlight">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium tracking-wide truncate">在管 VPS 节点</span>
            <span className="icon-tile w-8 h-8 shrink-0 ml-1 bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400">
              <HardDrives weight="duotone" className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-ink font-mono tabular-nums">{onlineCount}</span>
            <span className="text-xs text-ink-muted truncate">/ <span className="font-mono">{totalCount}</span> 在线</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px]">
          <span className="text-ink-muted truncate">协议模式</span>
          <span className="text-accent font-semibold whitespace-nowrap">Reality</span>
        </div>
      </div>

      {/* Card 4: Relay Status */}
      <div className="telemetry-card col-span-2 sm:col-span-1 lg:col-span-1 p-3.5 sm:p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden flex flex-col justify-between min-w-0 group card-lift card-spotlight">
        <div>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium tracking-wide truncate">链式解锁代理</span>
            <span className="icon-tile w-8 h-8 shrink-0 ml-1 bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400">
              <Graph weight="duotone" className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-ink font-mono tabular-nums">{relaysCount}</span>
            <span className="text-xs text-ink-muted truncate">条链式链路</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-rule-subtle flex items-center justify-between text-[11px]">
          <span className="text-ink-muted truncate">分流引擎</span>
          <span className="text-purple-600 dark:text-purple-400 font-semibold truncate ml-1">Xray 智能路由</span>
        </div>
      </div>
    </div>
  );
};
