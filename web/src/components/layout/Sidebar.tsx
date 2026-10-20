import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Gauge,
  HardDrives,
  Graph,
  LinkSimple,
  TerminalWindow,
  ArrowUpRight,
  ArrowDownRight,
  Broadcast,
  Pulse,
  PaperPlaneTilt,
  ChartBar,
  X,
  SignOut,
} from "@phosphor-icons/react";
import { RollingCounter } from "../common/RollingCounter";
import { useAuth } from "../../context/AuthContext";
import { PWAInstallButton } from "../common/PWAStatusBanner";
import { Logo } from "../common/Logo";
import { formatSpeed } from "../../utils/format";

type NavItem = { id: string; label: string; icon: React.ElementType };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "监控",
    items: [
      { id: "dashboard", label: "实时仪表盘", icon: Gauge },
      { id: "traffic", label: "业务流量统计", icon: ChartBar },
      { id: "ping", label: "延迟监测", icon: Pulse },
    ],
  },
  {
    label: "管理",
    items: [
      { id: "nodes", label: "多节点管理", icon: HardDrives },
      { id: "topology", label: "链式代理拓扑", icon: Graph },
      { id: "subscription", label: "订阅分享与导出", icon: LinkSimple },
    ],
  },
  {
    label: "运维",
    items: [
      { id: "script", label: "一键部署与脚本", icon: TerminalWindow },
      { id: "notifications", label: "Telegram 告警通知", icon: PaperPlaneTilt },
    ],
  },
];

interface NavListProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onlineCount: number;
  totalCount: number;
}

/** Grouped navigation with an indicator pill that glides to the active entry */
const NavList: React.FC<NavListProps> = ({ currentTab, onNavigate, onlineCount, totalCount }) => {
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({ top: 0, height: 0 });
  // Only glide between tabs — the very first placement should snap into position
  const [canGlide, setCanGlide] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[currentTab];
      if (!el || el.offsetHeight === 0) return;
      setIndicator({ top: el.offsetTop, height: el.offsetHeight });
      requestAnimationFrame(() => setCanGlide(true));
    };
    measure();
    // Drawer/desktop nav may be hidden (0 height) on first paint; re-measure once it lays out
    const ro = new ResizeObserver(measure);
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [currentTab]);

  return (
    <nav ref={navRef} className="relative p-3 overflow-y-auto max-h-[calc(100vh-15rem)]">
      {/* Gliding active indicator */}
      <div
        aria-hidden="true"
        className={`absolute left-3 right-3 rounded-lg bg-accent/10 border border-accent/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] pointer-events-none ${canGlide ? "transition-[top,height] duration-300 ease-out-expo" : ""} ${
          indicator.height > 0 ? "opacity-100" : "opacity-0"
        }`}
        style={{ top: indicator.top, height: indicator.height }}
      >
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-accent shadow-[0_0_10px_1px] shadow-accent/60" />
      </div>

      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? "mt-4" : ""}>
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-ink-muted uppercase tracking-[0.14em]">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              const href = item.id === "dashboard" ? "/" : `/${item.id}`;
              return (
                <a
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[item.id] = el;
                  }}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                      return; // Allow native browser new-tab click (Ctrl+Click / Cmd+Click)
                    }
                    e.preventDefault();
                    onNavigate(item.id);
                  }}
                  className={`group relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer select-none touch-manipulation ${
                    active ? "text-ink" : "text-ink-secondary hover:text-ink hover:bg-paper-hover/70"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      weight={active ? "duotone" : "regular"}
                      className={`w-[18px] h-[18px] shrink-0 transition-[color,transform] duration-300 ease-spring ${
                        active
                          ? "text-accent scale-110"
                          : "text-ink-muted group-hover:text-ink-secondary group-hover:scale-110"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.id === "nodes" && totalCount > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border tabular-nums ${
                        onlineCount === totalCount
                          ? "bg-status-online-bg text-status-online border-status-online/25"
                          : "bg-status-warning-bg text-status-warning border-status-warning/25"
                      }`}
                    >
                      {onlineCount}/{totalCount}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
};

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
  const { user, logout } = useAuth();
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

  const up = formatSpeed(totalUpSpeed);
  const down = formatSpeed(totalDownSpeed);
  const readyPct = totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0;
  const username = user?.username || "admin";

  const renderNavContent = (isMobile: boolean) => (
    <>
      {/* Brand & Status */}
      <div>
        <div className="h-16 flex items-center justify-between px-5 border-b border-rule">
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-ink tracking-tight">
                  NodeMaster
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-paper-3 text-ink-secondary border border-rule font-mono">
                  v1.0
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex w-1.5 h-1.5">
                  {wsConnected && (
                    <span className="absolute inset-0 rounded-full bg-status-online animate-ping opacity-60" />
                  )}
                  <span
                    className={`relative w-1.5 h-1.5 rounded-full ${
                      wsConnected ? "bg-status-online" : "bg-status-warning animate-pulse"
                    }`}
                  />
                </span>
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
        <NavList
          currentTab={currentTab}
          onlineCount={onlineCount}
          totalCount={totalCount}
          onNavigate={(tab) => {
            onSelectTab(tab);
            if (isMobile) {
              onCloseMobile?.();
            }
          }}
        />
      </div>

      {/* Live Bandwidth & Bottom Stats */}
      <div className="p-4 border-t border-rule space-y-3 bg-gradient-to-b from-transparent to-paper/60">
        <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.14em] flex items-center justify-between">
          <span>总带宽实时吞吐</span>
          <Broadcast weight="duotone" className="w-3.5 h-3.5 text-accent animate-pulse-soft" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Uplink */}
          <div className="p-2 rounded-lg bg-paper/60 border border-rule">
            <div className="flex items-center gap-1 text-ink-muted text-[11px]">
              <ArrowUpRight weight="bold" className="w-3 h-3 text-sky-400" />
              <span>上行速率</span>
            </div>
            <div className="text-xs font-mono font-semibold text-ink mt-0.5">
              <RollingCounter value={up.val} decimals={1} suffix={` ${up.unit}`} />
            </div>
          </div>

          {/* Downlink */}
          <div className="p-2 rounded-lg bg-paper/60 border border-rule">
            <div className="flex items-center gap-1 text-ink-muted text-[11px]">
              <ArrowDownRight weight="bold" className="w-3 h-3 text-emerald-400" />
              <span>下行速率</span>
            </div>
            <div className="text-xs font-mono font-semibold text-ink mt-0.5">
              <RollingCounter value={down.val} decimals={1} suffix={` ${down.unit}`} />
            </div>
          </div>
        </div>

        <div className="pt-1">
          <div className="text-[11px] text-ink-muted font-mono flex justify-between mb-1.5">
            <span>节点就绪率</span>
            <span className="text-ink tabular-nums">{readyPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-paper-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out-expo ${
                readyPct >= 90 ? "bg-status-online" : readyPct >= 50 ? "bg-status-warning" : "bg-status-danger"
              }`}
              style={{ width: `${readyPct}%` }}
            />
          </div>
        </div>

        {/* PWA Install Entry (Desktop & Mobile Drawer) */}
        <PWAInstallButton className="w-full justify-center py-2" />

        {/* Admin Account Status */}
        <div className="flex items-center justify-between pt-2.5 border-t border-rule-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-gradient-accent text-white text-xs font-bold flex items-center justify-center uppercase shrink-0 shadow-xs">
              {username.slice(0, 1)}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-xs font-mono font-medium text-ink truncate">{username}</div>
              <div className="text-[10px] text-status-online flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-status-online" />
                管理员
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors -mr-1"
            title="退出登录"
            aria-label="退出登录"
          >
            <SignOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (Only visible on md: screen and above) */}
      <aside
        className="hidden md:flex md:w-64 flex-shrink-0 bg-paper-2/80 backdrop-blur-xl border-r border-rule flex-col justify-between h-screen select-none sticky top-0"
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
              className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
                isMobileOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={handleBackdropClick}
              aria-hidden="true"
            />

            {/* Slide-over Drawer Panel */}
            <aside
              className={`fixed inset-y-0 left-0 z-10 w-72 max-w-[85vw] bg-paper-2 border-r border-rule flex flex-col justify-between h-full shadow-pop transition-transform duration-[400ms] ease-out-expo select-none ${
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
