import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  ArrowsClockwise,
  ShieldCheck,
  List,
  X,
  Key,
  SignOut,
  CaretDown,
  Sun,
  Moon,
  Desktop,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Button } from "../common/Button";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";
import { PWAInstallButton } from "../common/PWAStatusBanner";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  currentTab: string;
  onOpenAddModal: () => void;
  onRefresh: () => void;
  loading: boolean;
  onOpenMobileMenu?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenAddModal,
  onRefresh,
  loading,
  onOpenMobileMenu,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  onOpenSearch,
}) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const titles: Record<string, { title: string; desc: string }> = {
    dashboard: { title: "概览", desc: "全部节点的健康状况、带宽与需要处理的事项" },
    nodes: { title: "节点", desc: "主力直连、解锁落地与探针节点的管理" },
    traffic: { title: "流量统计", desc: "各节点网卡实测的上下行流量与配额" },
    ping: { title: "延迟监测", desc: "节点到国内三网测速点的回程质量" },
    topology: { title: "链式拓扑", desc: "入口节点到解锁落地出口的分流绑定" },
    subscription: { title: "订阅与导出", desc: "一条链接适配 Clash Meta / Sing-box / Egern / Shadowrocket" },
    script: { title: "接入节点", desc: "在 VPS 上运行一条命令完成接入与网络调优" },
    notifications: { title: "告警中心", desc: "通过 Telegram 推送离线、超额、到期与过载告警" },
  };

  const info = titles[currentTab] || { title: "控制台", desc: "" };

  return (
    <>
      <header className="h-16 border-b border-rule bg-paper/90 backdrop-blur-md px-3.5 sm:px-8 gap-3 flex items-center justify-between sticky top-0 z-20 select-none">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Hamburger Drawer Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onToggleMobileMenu) {
                onToggleMobileMenu();
              } else if (onOpenMobileMenu) {
                onOpenMobileMenu();
              }
            }}
            className="md:hidden flex items-center justify-center w-10 h-10 -ml-1 rounded-lg text-ink-secondary hover:text-ink hover:bg-paper-2 active:bg-paper-3 transition-colors cursor-pointer shrink-0 touch-manipulation"
            aria-label={isMobileMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X weight="bold" className="w-5 h-5 text-ink" />
            ) : (
              <List weight="bold" className="w-5 h-5" />
            )}
          </button>

          <div key={currentTab} className="min-w-0 animate-fade-up">
            <h1 className="text-sm sm:text-base font-semibold text-ink leading-tight truncate">
              {info.title}
            </h1>
            <p className="hidden sm:block text-xs text-ink-muted truncate max-w-sm lg:max-w-xl">
              {info.desc}
            </p>
          </div>
        </div>

        {/* Command palette trigger */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden md:flex shrink-0 xl:shrink xl:flex-1 xl:max-w-sm items-center gap-2 h-9 w-9 xl:w-auto justify-center xl:justify-start px-0 xl:px-3 rounded-lg border border-rule bg-paper-2 text-[13px] text-ink-muted hover:border-rule-active hover:text-ink-secondary transition-colors cursor-pointer"
          aria-label="搜索节点或跳转页面"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <MagnifyingGlass className="w-[15px] h-[15px]" />
          <span className="hidden xl:inline flex-1 text-left truncate">搜索节点、IP 或跳转页面…</span>
          <kbd className="hidden xl:inline font-mono text-[11px] px-1.5 py-0.5 border border-rule rounded-[5px]">Ctrl K</kbd>
        </button>

        {/* Right Action Bar: Unified 38px height, rounded-lg, seamless proportional spacing */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Telemetry Shield Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 h-9 rounded-lg bg-status-online-bg text-xs text-status-online select-none font-medium">
            <ShieldCheck weight="duotone" className="w-4 h-4 text-status-online shrink-0" />
            <span>熔断防护运行中</span>
          </div>

          {/* Theme Toggle: Pure 38x38px icon button */}
          <ThemeToggle />

          {/* PWA Install Button */}
          <PWAInstallButton className="hidden sm:flex h-9 px-3 rounded-lg" />

          {/* Refresh Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            loading={loading}
            icon={<ArrowsClockwise className="w-4 h-4 transition-transform duration-500 ease-out-expo group-hover:rotate-180" />}
            aria-label="刷新数据"
            className="h-9 px-3 text-xs"
          >
            <span className="hidden sm:inline">刷新</span>
          </Button>

          {/* Add Node Primary Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAddModal}
            icon={<Plus weight="bold" className="w-4 h-4" />}
            aria-label="添加节点"
            className="h-9 px-3.5 text-xs"
          >
            <span className="hidden sm:inline">添加节点</span>
          </Button>

          {/* Admin User Profile Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              className={`flex items-center gap-2 pl-1.5 pr-2.5 h-9 rounded-lg bg-paper-2 hover:bg-paper-3 border text-xs text-ink transition-colors cursor-pointer ${
                isUserMenuOpen ? "border-rule-active shadow-xs" : "border-rule"
              }`}
              title="管理员账户与安全设置"
            >
              <div className="w-6 h-6 rounded-md bg-gradient-accent text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {(user?.username || "admin").slice(0, 1)}
              </div>
              <span className="hidden sm:inline font-mono font-medium text-xs max-w-[80px] truncate">
                {user?.username || "admin"}
              </span>
              <CaretDown
                weight="bold"
                className={`w-3.5 h-3.5 text-ink-muted transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-52 origin-top-right bg-paper-2 border border-rule rounded-xl shadow-pop p-1.5 z-30 text-xs animate-pop-in"
              >
                <div className="px-2.5 pt-1.5 pb-2 mb-1 border-b border-rule text-ink-muted">
                  <div className="font-semibold text-ink font-mono">{user?.username || "admin"}</div>
                  <div className="text-[10px] text-status-online flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-online animate-pulse" />
                    <span>管理员在线</span>
                  </div>
                </div>

                {/* Appearance Preference selector */}
                <div className="pt-1 pb-1.5 mb-1 border-b border-rule">
                  <div className="px-2.5 py-1 text-[10px] font-medium tracking-wider text-ink-muted">
                    外观偏好
                  </div>
                  <div className="grid grid-cols-3 gap-1 px-1">
                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`py-1 px-1 rounded-md flex items-center justify-center gap-1 text-[11px] transition-colors cursor-pointer ${
                        theme === "light"
                          ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                          : "text-ink-secondary hover:bg-paper-hover"
                      }`}
                      title="浅色模式"
                    >
                      <Sun weight="duotone" className="w-3.5 h-3.5 text-status-warning" />
                      <span>浅色</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={`py-1 px-1 rounded-md flex items-center justify-center gap-1 text-[11px] transition-colors cursor-pointer ${
                        theme === "dark"
                          ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                          : "text-ink-secondary hover:bg-paper-hover"
                      }`}
                      title="深色模式"
                    >
                      <Moon weight="duotone" className="w-3.5 h-3.5 text-accent" />
                      <span>深色</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme("system")}
                      className={`py-1 px-1 rounded-md flex items-center justify-center gap-1 text-[11px] transition-colors cursor-pointer ${
                        theme === "system"
                          ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                          : "text-ink-secondary hover:bg-paper-hover"
                      }`}
                      title="跟随系统"
                    >
                      <Desktop weight="duotone" className="w-3.5 h-3.5 text-ink-muted" />
                      <span>系统</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  role="menuitem"
                  className="w-full px-2.5 py-2 rounded-lg text-left text-ink hover:bg-paper-3 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Key weight="duotone" className="w-4 h-4 text-accent" />
                  <span>修改管理密码</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  role="menuitem"
                  className="w-full px-2.5 py-2 rounded-lg text-left text-status-danger dark:text-status-danger hover:bg-status-danger/10 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <SignOut className="w-4 h-4" />
                  <span>退出管理员登录</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
};
