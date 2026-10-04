import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Gauge,
  HardDrives,
  ShareNetwork,
  LinkSimple,
  TerminalWindow,
  ArrowUpRight,
  ArrowDownRight,
  Broadcast,
  Pulse,
  PaperPlaneTilt,
  ChartBar,
  X,
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
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  wsConnected,
  totalUpSpeed,
  totalDownSpeed,
  onlineCount,
  totalCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const openTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isMobileOpen) {
      openTimeRef.current = Date.now();
    }
  }, [isMobileOpen]);

  // ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        onCloseMobile?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Prevent synthetic ghost click on mobile from immediately dismissing the drawer
    if (Date.now() - openTimeRef.current < 300) {
      return;
    }
    onCloseMobile?.();
  };

  const navItems = [
    { id: "dashboard", label: "实时仪表盘", icon: Gauge },
    { id: "nodes", label: "多节点管理", icon: HardDrives },
    { id: "traffic", label: "业务流量统计", icon: ChartBar },
    { id: "ping", label: "延迟监测", icon: Pulse },
    { id: "topology", label: "链式代理拓扑", icon: ShareNetwork },
    { id: "subscription", label: "订阅分享与导出", icon: LinkSimple },
    { id: "script", label: "一键部署与脚本", icon: TerminalWindow },
    { id: "notifications", label: "Telegram 告警通知", icon: PaperPlaneTilt },
  ];

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec > 1024 * 1024) {
      return { val: bytesPerSec / (1024 * 1024), unit: "MB/s" };
    }
    return { val: bytesPerSec / 1024, unit: "KB/s" };
  };

  const up = formatSpeed(totalUpSpeed);
  const down = formatSpeed(totalDownSpeed);

  const renderNavContent = (isMobile: boolean) => (
    <>
      {/* Brand & Status */}
      <div>
        <div className="h-16 flex items-center justify-between px-5 border-b border-rule">
          <div className="flex items-center gap-3">
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

          {/* Close Button on Mobile Drawer */}
          {isMobile && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseMobile?.();
              }}
              className="p-2 -mr-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer touch-manipulation"
              aria-label="关闭导航抽屉"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-14rem)]">
          <div className="px-3 py-1 text-[11px] font-mono text-ink-muted uppercase tracking-wider">
            控制台模块
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            const href = item.id === "dashboard" ? "/" : `/${item.id}`;
            return (
              <a
                key={item.id}
                href={href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                    return; // Allow native browser new-tab click (Ctrl+Click / Cmd+Click)
                  }
                  e.preventDefault();
                  onSelectTab(item.id);
                  if (isMobile) {
                    onCloseMobile?.();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation ${
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
              </a>
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
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (Only visible on md: screen and above) */}
      <aside
        className="hidden md:flex md:w-64 flex-shrink-0 bg-paper-2 border-r border-rule flex-col justify-between h-screen select-none sticky top-0"
        aria-label="主要导航"
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer (Portal into document.body to avoid parent layout/z-index containment) */}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${
              isMobileOpen
                ? "visible opacity-100 pointer-events-auto"
                : "invisible opacity-0 pointer-events-none"
            }`}
            aria-hidden={!isMobileOpen}
          >
            {/* Backdrop Overlay */}
            <div
              className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
                isMobileOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={handleBackdropClick}
              aria-hidden="true"
            />

            {/* Slide-over Drawer Panel */}
            <aside
              className={`fixed inset-y-0 left-0 z-10 w-72 max-w-[85vw] bg-paper-2 border-r border-rule flex flex-col justify-between h-full shadow-2xl transition-transform duration-300 ease-out select-none ${
                isMobileOpen ? "translate-x-0" : "-translate-x-full"
              }`}
              aria-label="移动端导航菜单"
              onClick={(e) => e.stopPropagation()}
            >
              {renderNavContent(true)}
            </aside>
          </div>,
          document.body
        )}
    </>
  );
};
