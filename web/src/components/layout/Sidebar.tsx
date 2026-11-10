import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  SquaresFour,
  HardDrives,
  Graph,
  LinkSimple,
  TerminalWindow,
  Pulse,
  BellSimple,
  ChartBar,
  X,
  SignOut,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../common/Logo";

type NavItem = { id: string; label: string; icon: React.ElementType };

/** Information architecture: 概览 / 节点 → 网络 → 分发 → 运维 */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [
      { id: "dashboard", label: "概览", icon: SquaresFour },
      { id: "nodes", label: "节点", icon: HardDrives },
    ],
  },
  {
    label: "网络",
    items: [
      { id: "traffic", label: "流量统计", icon: ChartBar },
      { id: "ping", label: "延迟监测", icon: Pulse },
      { id: "topology", label: "链式拓扑", icon: Graph },
    ],
  },
  {
    label: "分发",
    items: [{ id: "subscription", label: "订阅与导出", icon: LinkSimple }],
  },
  {
    label: "运维",
    items: [
      { id: "script", label: "接入节点", icon: TerminalWindow },
      { id: "notifications", label: "告警中心", icon: BellSimple },
    ],
  },
];

interface NavListProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onlineCount: number;
  totalCount: number;
}

const NavList: React.FC<NavListProps> = ({ currentTab, onNavigate, onlineCount, totalCount }) => (
  <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
    {NAV_GROUPS.map((group) => (
      <div key={group.label || "root"} className="space-y-0.5">
        {group.label && (
          <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-ink-muted tracking-[0.06em]">
            {group.label}
          </div>
        )}
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          const href = item.id === "dashboard" ? "/" : `/${item.id}`;
          const unhealthy = totalCount > 0 && onlineCount < totalCount;
          return (
            <a
              key={item.id}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                onNavigate(item.id);
              }}
              className={`flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13.5px] transition-colors duration-150 select-none touch-manipulation ${
                active
                  ? "bg-accent-subtle text-ink font-semibold shadow-[inset_2px_0_0_0_var(--color-accent)]"
                  : "text-ink-secondary font-medium hover:text-ink hover:bg-paper-hover"
              }`}
            >
              <Icon weight={active ? "fill" : "regular"} className={`w-[17px] h-[17px] shrink-0 ${active ? "text-accent" : ""}`} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.id === "nodes" && totalCount > 0 && (
                <span
                  className={`font-mono text-[11px] px-1.5 rounded-[5px] tabular-nums ${
                    unhealthy ? "bg-status-warning-bg text-status-warning" : "bg-paper-3 text-ink-muted"
                  }`}
                >
                  {onlineCount}/{totalCount}
                </span>
              )}
            </a>
          );
        })}
      </div>
    ))}
  </nav>
);

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  wsConnected: boolean;
  onlineCount: number;
  totalCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  wsConnected,
  onlineCount,
  totalCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const openTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isMobileOpen) openTimeRef.current = Date.now();
  }, [isMobileOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) onCloseMobile?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Ignore the synthetic ghost click that follows the tap which opened the drawer
    if (Date.now() - openTimeRef.current < 300) return;
    onCloseMobile?.();
  };

  const username = user?.username || "admin";

  const renderNavContent = (isMobile: boolean) => (
    <>
      <div className="h-16 flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <div className="leading-tight">
            <div className="font-bold text-[15px] text-ink tracking-tight">NodeMaster</div>
            <div className="text-[11px] text-ink-muted font-mono">v1.0 · 控制面板</div>
          </div>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCloseMobile?.();
            }}
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer touch-manipulation"
            aria-label="关闭导航"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <NavList
        currentTab={currentTab}
        onlineCount={onlineCount}
        totalCount={totalCount}
        onNavigate={(tab) => {
          onSelectTab(tab);
          if (isMobile) onCloseMobile?.();
        }}
      />

      <div className="m-3 p-3 rounded-[10px] border border-rule bg-paper-2 space-y-2.5 shrink-0">
        <div className="flex items-center gap-2 text-xs text-ink-secondary">
          <span
            className={`w-[7px] h-[7px] rounded-full ${wsConnected ? "bg-status-online" : "bg-status-warning animate-pulse"}`}
          />
          <span>{wsConnected ? "实时通道已连接" : "正在连接实时通道…"}</span>
          <span className="ml-auto font-mono text-ink-muted">WS</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-full bg-accent-subtle text-accent text-[13px] font-semibold flex items-center justify-center uppercase shrink-0">
            {username.slice(0, 1)}
          </span>
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[13px] font-semibold text-ink truncate">{username}</div>
            <div className="text-[11px] text-ink-muted">管理员</div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-secondary hover:text-status-danger hover:bg-status-danger-bg cursor-pointer transition-colors"
            aria-label="退出登录"
            title="退出登录"
          >
            <SignOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside
        className="hidden md:flex md:w-[232px] flex-shrink-0 bg-paper border-r border-rule flex-col h-screen select-none sticky top-0"
        aria-label="主导航"
      >
        {renderNavContent(false)}
      </aside>

      {typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${
              isMobileOpen ? "visible opacity-100 pointer-events-auto" : "invisible opacity-0 pointer-events-none"
            }`}
            aria-hidden={!isMobileOpen}
          >
            <div
              className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${isMobileOpen ? "opacity-100" : "opacity-0"}`}
              onClick={handleBackdropClick}
              aria-hidden="true"
            />
            <aside
              className={`fixed inset-y-0 left-0 z-10 w-72 max-w-[85vw] bg-paper border-r border-rule flex flex-col h-full shadow-pop transition-transform duration-[400ms] ease-out-expo select-none ${
                isMobileOpen ? "translate-x-0" : "-translate-x-full"
              }`}
              aria-label="移动端导航"
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
