import React from "react";
import { Plus, ArrowsClockwise, ShieldCheck } from "@phosphor-icons/react";
import { Button } from "../common/Button";

interface HeaderProps {
  currentTab: string;
  onOpenAddModal: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenAddModal,
  onRefresh,
  loading,
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
    <header className="h-16 border-b border-rule bg-paper/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-base font-semibold text-ink leading-tight">
          {info.title}
        </h1>
        <p className="text-xs text-ink-muted">{info.desc}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-paper-2 border border-rule text-xs text-ink-secondary font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>熔断防护已激活</span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          loading={loading}
          icon={<ArrowsClockwise className="w-3.5 h-3.5" />}
        >
          刷新
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenAddModal}
          icon={<Plus weight="bold" className="w-3.5 h-3.5" />}
        >
          添加节点
        </Button>
      </div>
    </header>
  );
};
