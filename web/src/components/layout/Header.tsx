import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  ArrowsClockwise,
  ShieldCheck,
  List,
  X,
  User,
  Key,
  SignOut,
  CaretDown,
} from "@phosphor-icons/react";
import { Button } from "../common/Button";
import { useAuth } from "../../context/AuthContext";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";
import { PWAInstallButton } from "../common/PWAStatusBanner";

interface HeaderProps {
  currentTab: string;
  onOpenAddModal: () => void;
  onRefresh: () => void;
  loading: boolean;
  onOpenMobileMenu?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenAddModal,
  onRefresh,
  loading,
  onOpenMobileMenu,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
}) => {
  const { user, logout } = useAuth();
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
    dashboard: {
      title: "实时仪表盘",
      desc: "全节点实时运行工况、带宽吞吐与当月流量监控",
    },
    nodes: {
      title: "多 VPS 节点管理",
      desc: "支持 VLESS-Reality 免证书协议、Dokodemo 转发与实时指标统计",
    },
    traffic: {
      title: "业务流量统计与服务分析",
      desc: "按节点与协议维度的实时上行/下行流量消耗与统计分析",
    },
    ping: {
      title: "延迟监测",
      desc: "多测速目标网络质量、丢包率与抖动时序监控",
    },
    topology: {
      title: "链式代理与解锁拓扑",
      desc: "主力直连机与专属解锁机智能分流绑定与流向拓扑",
    },
    subscription: {
      title: "订阅分享与客户端导出",
      desc: "自动识别客户端输出 Clash Meta / Sing-box / Shadowrocket",
    },
    script: {
      title: "一键部署与脚本",
      desc: "官方 Linux VPS 一键 Agent 安装命令与 Xray 服务集成",
    },
    notifications: {
      title: "Telegram 告警通知",
      desc: "配置 Bot 机器人推送，实现离线、流量超额、VPS 续费到期、CPU 及内存占用实时预警",
    },
  };

  const info = titles[currentTab] || { title: "控制台", desc: "" };

  return (
    <>
      <header className="h-16 border-b border-rule bg-paper/75 backdrop-blur-md px-3.5 sm:px-6 flex items-center justify-between sticky top-0 z-20 select-none">
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

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-ink leading-tight truncate">
              {info.title}
            </h1>
            <p className="hidden sm:block text-xs text-ink-muted truncate max-w-sm lg:max-w-xl">
              {info.desc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-paper-2 border border-rule text-xs text-ink-secondary font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>熔断防护已激活</span>
          </div>

          <PWAInstallButton className="hidden sm:flex" />

          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            loading={loading}
            icon={<ArrowsClockwise className="w-4 h-4" />}
            aria-label="刷新数据"
            className="min-h-[38px] px-2.5 sm:px-3 text-xs"
          >
            <span className="hidden sm:inline">刷新</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAddModal}
            icon={<Plus weight="bold" className="w-4 h-4" />}
            aria-label="添加节点"
            className="min-h-[38px] px-2.5 sm:px-3 text-xs"
          >
            <span className="hidden sm:inline">添加节点</span>
          </Button>

          {/* Admin User Profile Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-paper-2 hover:bg-paper-3 border border-rule text-xs text-ink transition-colors cursor-pointer"
              title="管理员账户与安全设置"
            >
              <div className="w-6 h-6 rounded-md bg-accent/15 text-accent flex items-center justify-center font-bold">
                <User weight="bold" className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline font-mono font-medium text-xs max-w-[80px] truncate">
                {user?.username || "admin"}
              </span>
              <CaretDown className="w-3 h-3 text-ink-muted" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-paper-2 border border-rule rounded-xl shadow-xl py-1.5 z-30 text-xs">
                <div className="px-3 py-1.5 border-b border-rule text-ink-muted">
                  <div className="font-semibold text-ink font-mono">{user?.username || "admin"}</div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>管理员在线</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-ink hover:bg-paper-3 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Key className="w-4 h-4 text-accent" />
                  <span>修改管理密码</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors"
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
