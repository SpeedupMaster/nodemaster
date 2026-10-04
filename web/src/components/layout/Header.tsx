import React from "react";
import { Plus, ArrowsClockwise, ShieldCheck, List, X } from "@phosphor-icons/react";
import { Button } from "../common/Button";

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
      </div>
    </header>
  );
};
