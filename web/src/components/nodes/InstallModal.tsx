import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { NodeItem } from "../../types";
import {
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Pulse,
  Cpu,
  Lightning,
  Globe,
  Sliders,
  ArrowSquareOut,
  Sparkle,
  CheckCircle,
} from "@phosphor-icons/react";

interface InstallModalProps {
  node: NodeItem | null;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ node, onClose }) => {
  const [activeTab, setActiveTab] = useState<"install" | "tune">("install");
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedTuneOfficial, setCopiedTuneOfficial] = useState(false);
  const [copiedTunePanel, setCopiedTunePanel] = useState(false);
  const [deployMode, setDeployMode] = useState<"all" | "probe_only">("all");
  const [enableBbr, setEnableBbr] = useState(true);
  const [enableIpv4First, setEnableIpv4First] = useState(false);

  if (!node) return null;

  const panelHost = window.location.origin;

  // 拼接参数
  const args: string[] = [`--panel ${panelHost}`, `--token ${node.token}`];
  if (deployMode === "probe_only") {
    args.push("--probe-only");
  }
  if (enableBbr) {
    args.push("--bbr");
  }
  if (enableIpv4First) {
    args.push("--ipv4-first");
  }

  const installCmd = `curl -fsSL ${panelHost}/api/install.sh | bash -s -- ${args.join(" ")}`;
  const tuneOfficialCmd = `bash <(curl -sL tcp.vpsing.de)`;
  const tunePanelCmd = `curl -fsSL ${panelHost}/api/tcp-tune.sh | bash`;

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(installCmd);
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  const handleCopyTuneOfficial = () => {
    navigator.clipboard.writeText(tuneOfficialCmd);
    setCopiedTuneOfficial(true);
    setTimeout(() => setCopiedTuneOfficial(false), 2000);
  };

  const handleCopyTunePanel = () => {
    navigator.clipboard.writeText(tunePanelCmd);
    setCopiedTunePanel(true);
    setTimeout(() => setCopiedTunePanel(false), 2000);
  };

  return (
    <Modal
      isOpen={!!node}
      onClose={onClose}
      title={`${node.name} - VPS 一键上线与网络调优`}
      subtitle="在目标 VPS 的 root SSH 终端执行下方命令，完成节点上线与生产级网络优化"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Tab 导航 */}
        <div className="flex border-b border-rule gap-1 -mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("install")}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "install"
                ? "border-accent text-accent"
                : "border-transparent text-ink-secondary hover:text-ink hover:border-rule"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>节点一键部署与纳管</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tune")}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "tune"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-ink-secondary hover:text-ink hover:border-rule"
            }`}
          >
            <Lightning className="w-3.5 h-3.5 text-emerald-400" />
            <span>独立 BBR / TCP 调优</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              tcp-dashboard
            </span>
          </button>
        </div>

        {activeTab === "install" && (
          <div className="space-y-4">
            {/* 部署模式选择器 */}
            <div>
              <label className="text-xs font-medium text-ink-secondary mb-1.5 block">
                选择部署模式:
              </label>
              <div className="grid grid-cols-2 p-1 bg-paper border border-rule rounded-lg gap-1.5">
                <button
                  type="button"
                  onClick={() => setDeployMode("all")}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    deployMode === "all"
                      ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                      : "text-ink-secondary hover:text-ink hover:bg-paper-2 border border-transparent"
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>同时部署探针与节点</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                      deployMode === "all" ? "bg-accent/25 text-accent" : "bg-paper-3 text-ink-muted"
                    }`}
                  >
                    全量纳管
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeployMode("probe_only")}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    deployMode === "probe_only"
                      ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                      : "text-ink-secondary hover:text-ink hover:bg-paper-2 border border-transparent"
                  }`}
                >
                  <Pulse className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>仅部署探针</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                      deployMode === "probe_only" ? "bg-accent/25 text-accent" : "bg-paper-3 text-ink-muted"
                    }`}
                  >
                    纯监控
                  </span>
                </button>
              </div>
            </div>

            {/* 网络内核调优配置选项 (集成 tcp-dashboard) */}
            <div className="p-3 rounded-lg bg-paper-2 border border-rule space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-accent" />
                  网络与内核优化选项 (基于 tcp-dashboard)
                </span>
                <span className="text-[10px] text-ink-muted flex items-center gap-1">
                  <Sparkle className="w-3 h-3 text-amber-400" />
                  生产级跨境链路增强
                </span>
              </div>

              {/* BBR + FQ 开关 */}
              <label className="flex items-start gap-2.5 p-2 rounded-md hover:bg-paper cursor-pointer transition-colors border border-transparent hover:border-rule">
                <input
                  type="checkbox"
                  checked={enableBbr}
                  onChange={(e) => setEnableBbr(e.target.checked)}
                  className="mt-0.5 rounded border-rule text-accent focus:ring-0 focus:outline-none"
                />
                <div className="text-xs">
                  <div className="font-medium text-ink flex items-center gap-1.5">
                    <span>开启 TCP / BBR 跨境深度网络调优</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-normal">
                      推荐开启
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                    自动配置 BBR+FQ 算法、动态分配 5% 物理内存缓冲区、提升至 1,048,576
                    句柄上限、注入 Reality/Hysteria2 专项低延迟与防丢包补丁、网卡 RPS 多队列均衡，并生成终端快捷命令{" "}
                    <code className="text-accent font-mono bg-paper-3 px-1 rounded">t</code>。
                  </p>
                </div>
              </label>

              {/* IPv4 优先开关 */}
              <label className="flex items-start gap-2.5 p-2 rounded-md hover:bg-paper cursor-pointer transition-colors border border-transparent hover:border-rule">
                <input
                  type="checkbox"
                  checked={enableIpv4First}
                  onChange={(e) => setEnableIpv4First(e.target.checked)}
                  className="mt-0.5 rounded border-rule text-accent focus:ring-0 focus:outline-none"
                />
                <div className="text-xs">
                  <div className="font-medium text-ink flex items-center gap-1.5">
                    <span>优先使用 IPv4 网络解析</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted font-normal">
                      双栈优化
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                    写入 <code className="text-ink-secondary font-mono bg-paper-3 px-1 rounded">/etc/gai.conf</code> 优先策略，规避部分双栈 VPS 由于 IPv6 劣质路由绕路导致的 TCP/TLS 握手延迟与断流。
                  </p>
                </div>
              </label>
            </div>

            {/* 一键执行命令 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  一键执行命令
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyInstall}
                  icon={
                    copiedInstall ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {copiedInstall ? "已复制命令" : "复制命令"}
                </Button>
              </div>

              <div className="p-3.5 rounded-md bg-paper border border-rule font-mono text-xs text-accent select-all break-all leading-relaxed">
                {installCmd}
              </div>
            </div>

            <div className="pt-2 border-t border-rule text-xs text-ink-muted flex items-center justify-between font-mono">
              <span>专属安全 Token:</span>
              <span className="text-ink-secondary">{node.token}</span>
            </div>
          </div>
        )}

        {activeTab === "tune" && (
          <div className="space-y-4">
            {/* 项目来源与介绍 */}
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-emerald-400">
                  <Lightning weight="fill" className="w-4 h-4 text-emerald-400" />
                  <span>开源 TCP-Dashboard 网络性能调优体系</span>
                </div>
                <a
                  href="https://github.com/666shen/tcp-dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-400/80 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                >
                  <span>GitHub 仓库</span>
                  <ArrowSquareOut className="w-3 h-3" />
                </a>
              </div>
              <p className="text-ink-secondary mt-1.5 leading-relaxed">
                无需重新纳管节点！针对已在运行的任意 Linux VPS，您只需在终端运行一次调优命令。部署完成后，随时在 SSH 终端敲{" "}
                <code className="text-emerald-400 font-mono bg-paper-3 px-1 py-0.5 rounded font-bold">t</code>{" "}
                即可唤起可视化交互看板。
              </p>
            </div>

            {/* 调优技术规范亮点 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-md bg-paper border border-rule">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>BBR + FQ 拥塞控制</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  降低跨境高丢包链路延迟，显著提升单线程与多线程吞吐。
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-paper border border-rule">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>5% 物理内存动态缓冲区</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  根据 VPS 实际内存动态计算并分配 16MB ~ 128MB 网络缓存。
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-paper border border-rule">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>1,048,576 句柄与连接池</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  支撑 6w+ 并发连接， somaxconn 65535 防止队列溢出。
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-paper border border-rule">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Reality / HY2 专项补丁</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  0ms TTFB 发送积压、MTU 路径黑洞探测、UDP 深度扩容。
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-paper border border-rule">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>网卡 RPS/RSS 多队列均衡</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  解除单核软中断（SoftIRQ）瓶颈，大流量平摊至所有 CPU 核心。
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-paper border border-rule">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>终端交互看板快捷键 (t)</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  生成系统级软链接，SSH 敲 <code className="text-emerald-400 font-mono font-bold">t</code> 随时进入多功能控制台。
                </div>
              </div>
            </div>

            {/* 独立运行命令选项 */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>方式 A: 官方开源一键命令 (推荐)</span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyTuneOfficial}
                    icon={
                      copiedTuneOfficial ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {copiedTuneOfficial ? "已复制" : "复制命令"}
                  </Button>
                </div>
                <div className="p-3 rounded-md bg-paper border border-rule font-mono text-xs text-emerald-400 select-all break-all">
                  {tuneOfficialCmd}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-accent" />
                    <span>方式 B: NodeMaster 面板内网镜像源</span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyTunePanel}
                    icon={
                      copiedTunePanel ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {copiedTunePanel ? "已复制" : "复制命令"}
                  </Button>
                </div>
                <div className="p-3 rounded-md bg-paper border border-rule font-mono text-xs text-accent select-all break-all">
                  {tunePanelCmd}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
