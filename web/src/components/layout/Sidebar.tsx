import React from "react";
import {
  Gauge,
  HardDrives,
  ShareNetwork,
  LinkSimple,
  TerminalWindow,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  Broadcast,
  Pulse,
  ArrowsSplit,
} from "@phosphor-icons/react";
import { RollingCounter } from "../common/RollingCounter";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  wsConnected: boolean;
  totalUpSpeed: number;
  totalDownSpeed: number;
  onlineCount: number;
  totalCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  wsConnected,
  totalUpSpeed,
  totalDownSpeed,
  onlineCount,
  totalCount,
}) => {
  const navItems = [
    { id: "dashboard", label: "实时仪表盘", icon: Gauge },
    { id: "nodes", label: "多节点管理", icon: HardDrives },
    { id: "ping", label: "延迟监测", icon: Pulse },
    { id: "topology", label: "链式代理拓扑", icon: ShareNetwork },
    { id: "routing", label: "分流规则编排", icon: ArrowsSplit },
    { id: "subscription", label: "订阅分享与导出", icon: LinkSimple },
    { id: "script", label: "一键部署与脚本", icon: TerminalWindow },
  ];

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec > 1024 * 1024) {
      return { val: bytesPerSec / (1024 * 1024), unit: "MB/s" };
    }
    return { val: bytesPerSec / 1024, unit: "KB/s" };
  };

  const up = formatSpeed(totalUpSpeed);
  const down = formatSpeed(totalDownSpeed);

  return (
    <aside className="w-64 flex-shrink-0 bg-paper-2 border-r border-rule flex flex-col justify-between h-screen select-none sticky top-0">
      {/* Brand & Status */}
      <div>
        <div className="h-16 flex items-center px-5 border-b border-rule gap-3">
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-paper font-bold shadow">
            <ShareNetwork weight="bold" className="w-5 h-5 text-paper" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-ink tracking-tight">
                NodeMaster
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-secondary border border-rule font-mono">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsConnected ? "bg-status-online animate-pulse" : "bg-status-warning"
                }`}
              />
              <span className="text-[11px] text-ink-muted font-mono">
                {wsConnected ? "遥测在线 (WS)" : "正在连接..."}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1 text-[11px] font-mono text-ink-muted uppercase tracking-wider">
            控制台模块
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-ink-secondary hover:text-ink hover:bg-paper-hover border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    weight={active ? "fill" : "regular"}
                    className={`w-4 h-4 ${active ? "text-accent" : "text-ink-muted"}`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.id === "nodes" && (
                  <span className="text-xs font-mono px-1.5 py-0.2 rounded bg-paper-3 text-ink-secondary border border-rule">
                    {onlineCount}/{totalCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Live Bandwidth & Bottom Stats */}
      <div className="p-4 border-t border-rule space-y-3 bg-paper/40">
        <div className="text-[11px] font-mono text-ink-muted uppercase flex items-center justify-between">
          <span>总带宽实时吞吐</span>
          <Broadcast className="w-3.5 h-3.5 text-accent animate-pulse" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Uplink */}
          <div className="p-2 rounded bg-paper-2 border border-rule">
            <div className="flex items-center gap-1 text-ink-muted text-[11px]">
              <ArrowUpRight className="w-3 h-3 text-sky-400" />
              <span>上行速率</span>
            </div>
            <div className="text-xs font-mono font-semibold text-ink mt-0.5">
              <RollingCounter value={up.val} decimals={1} suffix={` ${up.unit}`} />
            </div>
          </div>

          {/* Downlink */}
          <div className="p-2 rounded bg-paper-2 border border-rule">
            <div className="flex items-center gap-1 text-ink-muted text-[11px]">
              <ArrowDownRight className="w-3 h-3 text-emerald-400" />
              <span>下行速率</span>
            </div>
            <div className="text-xs font-mono font-semibold text-ink mt-0.5">
              <RollingCounter value={down.val} decimals={1} suffix={` ${down.unit}`} />
            </div>
          </div>
        </div>

        <div className="text-[11px] text-ink-muted font-mono flex justify-between pt-1 border-t border-rule-subtle">
          <span>节点就绪率</span>
          <span className="text-ink">
            {totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0}%
          </span>
        </div>
      </div>
    </aside>
  );
};
