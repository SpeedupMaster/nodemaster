import React, { useState, useEffect } from "react";
import { Button } from "../common/Button";
import {
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
  Pulse,
  Lightning,
  Sliders,
  Globe,
  ArrowSquareOut,
  Sparkle,
  CheckCircle,
} from "@phosphor-icons/react";

export const ScriptView: React.FC = () => {
  const [scriptContent, setScriptContent] = useState("");
  const [tcpTuneContent, setTcpTuneContent] = useState("");
  const [activePreview, setActivePreview] = useState<"install" | "tcp_tune">("install");
  const [copiedGeneric, setCopiedGeneric] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedTuneOfficial, setCopiedTuneOfficial] = useState(false);
  const [copiedTunePanel, setCopiedTunePanel] = useState(false);
  const [deployMode, setDeployMode] = useState<"all" | "probe_only">("all");
  const [enableBbr, setEnableBbr] = useState(true);
  const [enableIpv4First, setEnableIpv4First] = useState(false);

  const panelHost = window.location.origin;

  const genericArgs: string[] = [`--panel ${panelHost}`, `--token <NODE_TOKEN>`];
  if (deployMode === "probe_only") {
    genericArgs.push("--probe-only");
  }
  if (enableBbr) {
    genericArgs.push("--bbr");
  }
  if (enableIpv4First) {
    genericArgs.push("--ipv4-first");
  }

  const genericCmd = `curl -fsSL ${panelHost}/api/install.sh | bash -s -- ${genericArgs.join(" ")}`;
  const tuneOfficialCmd = `bash <(curl -sL tcp.vpsing.de)`;
  const tunePanelCmd = `curl -fsSL ${panelHost}/api/tcp-tune.sh | bash`;

  useEffect(() => {
    fetch("/api/install.sh")
      .then((r) => r.text())
      .then((txt) => setScriptContent(txt))
      .catch((e) => console.error(e));

    fetch("/api/tcp-tune.sh")
      .then((r) => r.text())
      .then((txt) => setTcpTuneContent(txt))
      .catch((e) => console.error(e));
  }, []);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(genericCmd);
    setCopiedGeneric(true);
    setTimeout(() => setCopiedGeneric(false), 2000);
  };

  const handleCopyScript = () => {
    const textToCopy = activePreview === "install" ? scriptContent : tcpTuneContent;
    navigator.clipboard.writeText(textToCopy);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
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
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
        <div className="flex items-center gap-2.5">
          <Terminal weight="bold" className="w-5 h-5 text-accent" />
          <h2 className="text-base font-semibold text-ink">
            VPS 代理节点、系统探针与 BBR 深度网络调优部署中心
          </h2>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed max-w-3xl">
          NodeMaster 采用 Master-Agent 架构。当您在面板添加节点后，可选择「同时部署探针与节点」或「仅部署探针」模式生成专属安装命令。现已深度集成开源{" "}
          <a
            href="https://github.com/666shen/tcp-dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline font-medium hover:text-accent/80"
          >
            tcp-dashboard
          </a>{" "}
          网络性能调优套件，自动检测 VPS 硬件架构与内存，配置生产级高并发连接池与跨境防丢包补丁，并在目标 VPS 创建终端快捷命令{" "}
          <code className="text-accent font-mono bg-paper-3 px-1 rounded">t</code>。
        </p>

        {/* 部署选项配置 */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1.5 block">
              部署模式:
            </label>
            <div className="grid grid-cols-2 max-w-md p-1 bg-paper border border-rule rounded-lg gap-1.5">
              <button
                type="button"
                onClick={() => setDeployMode("all")}
                className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  deployMode === "all"
                    ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                    : "text-ink-secondary hover:text-ink hover:bg-paper-2 border border-transparent"
                }`}
              >
                <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
                <span>全量纳管 (内核 + 探针)</span>
              </button>
              <button
                type="button"
                onClick={() => setDeployMode("probe_only")}
                className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  deployMode === "probe_only"
                    ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                    : "text-ink-secondary hover:text-ink hover:bg-paper-2 border border-transparent"
                }`}
              >
                <Pulse className="w-3.5 h-3.5 flex-shrink-0" />
                <span>仅部署探针 (纯监控)</span>
              </button>
            </div>
          </div>

          {/* 网络优化微调开关 */}
          <div className="p-3 max-w-xl rounded-lg bg-paper border border-rule space-y-2">
            <span className="text-xs font-medium text-ink flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-accent" />
              内核性能优化参数附加:
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-paper-2 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={enableBbr}
                  onChange={(e) => setEnableBbr(e.target.checked)}
                  className="rounded border-rule text-accent focus:ring-0 focus:outline-none"
                />
                <span className="text-ink-secondary font-medium">--bbr (开启 BBR+FQ 深度调优)</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-paper-2 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={enableIpv4First}
                  onChange={(e) => setEnableIpv4First(e.target.checked)}
                  className="rounded border-rule text-accent focus:ring-0 focus:outline-none"
                />
                <span className="text-ink-secondary font-medium">--ipv4-first (IPv4 优先解析)</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono text-ink-secondary">
              通用纳管部署指令模板 (请将 &lt;NODE_TOKEN&gt; 替换为节点专属 Token):
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyCmd}
              icon={copiedGeneric ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedGeneric ? "已复制命令" : "复制命令"}
            </Button>
          </div>
          <div className="p-3.5 rounded-md bg-paper border border-rule font-mono text-xs text-accent select-all break-all">
            {genericCmd}
          </div>
        </div>
      </div>

      {/* TCP/BBR 跨境性能调优独立专区 (tcp-dashboard) */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lightning weight="fill" className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                <span>TCP-Dashboard 跨境网络深度优化套件</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                  vpsing.de
                </span>
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                基于 666shen/tcp-dashboard 开源项目深度融合，针对高丢包跨境物理链路与流媒体/代理节点量身打磨
              </p>
            </div>
          </div>

          <a
            href="https://github.com/666shen/tcp-dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
          >
            <span>GitHub 仓库</span>
            <ArrowSquareOut className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 6 大调优特性网格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-paper border border-rule space-y-1">
            <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>BBR + FQ 拥塞算法</span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              激活 Linux 内核级 BBR 引擎与 FQ 步进调度，动态对抗链路丢包，大幅提升单线程下载速率。
            </p>
          </div>

          <div className="p-3 rounded-lg bg-paper border border-rule space-y-1">
            <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>5% 物理内存动态缓冲</span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              精准探测系统物理内存，动态按 5% 配比设置 TCP 读写缓冲区 (16MB ~ 128MB)，杜绝内存泄漏。
            </p>
          </div>

          <div className="p-3 rounded-lg bg-paper border border-rule space-y-1">
            <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>1,048,576 句柄与连接池</span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              somaxconn 65535、backlog 16384，完全解除 Linux 文件句柄上限，从容应对超 60,000+ 高并发连接。
            </p>
          </div>

          <div className="p-3 rounded-lg bg-paper border border-rule space-y-1">
            <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Reality / HY2 专项补丁</span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              tcp_notsent_lowat 降低首包 TTFB、MTU 黑洞探测、UDP Ring 扩容，ECN 智能标记轻微拥塞不丢包。
            </p>
          </div>

          <div className="p-3 rounded-lg bg-paper border border-rule space-y-1">
            <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>网卡 RPS/RSS 多队列均衡</span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              解除单核心软中断（SoftIRQ）瓶颈，将物理/虚拟网卡硬件中断负载均匀平摊至 VPS 所有 CPU 核心。
            </p>
          </div>

          <div className="p-3 rounded-lg bg-paper border border-rule space-y-1">
            <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>SSH 终端快捷指令「t」</span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              在服务器终端任意路径敲 <code className="text-emerald-400 font-mono font-bold">t</code> 即可进入全中文交互式面板，随时自检与回退设置。
            </p>
          </div>
        </div>

        {/* 独立执行命令 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-lg bg-paper border border-rule space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>官方开源一键命令 (推荐):</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyTuneOfficial}
                icon={copiedTuneOfficial ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedTuneOfficial ? "已复制" : "复制"}
              </Button>
            </div>
            <div className="p-2.5 rounded bg-paper-2 border border-rule font-mono text-xs text-emerald-400 select-all break-all">
              {tuneOfficialCmd}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-paper border border-rule space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span>NodeMaster 面板镜像源:</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyTunePanel}
                icon={copiedTunePanel ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedTunePanel ? "已复制" : "复制"}
              </Button>
            </div>
            <div className="p-2.5 rounded bg-paper-2 border border-rule font-mono text-xs text-accent select-all break-all">
              {tunePanelCmd}
            </div>
          </div>
        </div>
      </div>

      {/* Script Source Preview */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-rule">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                下发脚本源码在线预览
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                主控端动态分发，原生兼容 Debian 11/12、Ubuntu 20/22/24、CentOS 7/8/9、Rocky Linux
              </p>
            </div>

            {/* 切换预览的脚本 */}
            <div className="flex bg-paper border border-rule rounded-lg p-0.5 gap-1">
              <button
                type="button"
                onClick={() => setActivePreview("install")}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
                  activePreview === "install"
                    ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                install.sh (联合纳管)
              </button>
              <button
                type="button"
                onClick={() => setActivePreview("tcp_tune")}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
                  activePreview === "tcp_tune"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                tcp-tune.sh (TCP 调优)
              </button>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyScript}
            icon={copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copiedScript ? "已复制脚本" : "复制代码"}
          </Button>
        </div>

        <div className="relative rounded-md bg-paper border border-rule overflow-hidden">
          <pre className="p-4 text-xs font-mono text-ink-secondary overflow-x-auto max-h-[460px] leading-relaxed select-all">
            {activePreview === "install"
              ? scriptContent || "正在获取 install.sh 脚本源码..."
              : tcpTuneContent || "正在获取 tcp-tune.sh 脚本源码..."}
          </pre>
        </div>
      </div>
    </div>
  );
};
