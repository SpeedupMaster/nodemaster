import React, { useState, useEffect } from "react";
import { Button } from "../common/Button";
import { Terminal, Copy, Check, ShieldCheck, Cpu, Pulse } from "@phosphor-icons/react";

export const ScriptView: React.FC = () => {
  const [scriptContent, setScriptContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedGeneric, setCopiedGeneric] = useState(false);
  const [deployMode, setDeployMode] = useState<"all" | "probe_only">("all");

  const panelHost = window.location.origin;
  const genericCmd =
    deployMode === "probe_only"
      ? `curl -fsSL ${panelHost}/api/install.sh | bash -s -- --panel ${panelHost} --token <NODE_TOKEN> --probe-only`
      : `curl -fsSL ${panelHost}/api/install.sh | bash -s -- --panel ${panelHost} --token <NODE_TOKEN>`;

  useEffect(() => {
    fetch("/api/install.sh")
      .then((r) => r.text())
      .then((txt) => setScriptContent(txt))
      .catch((e) => console.error(e));
  }, []);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(genericCmd);
    setCopiedGeneric(true);
    setTimeout(() => setCopiedGeneric(false), 2000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
        <div className="flex items-center gap-2.5">
          <Terminal weight="bold" className="w-5 h-5 text-accent" />
          <h2 className="text-base font-semibold text-ink">
            VPS 代理节点与系统探针联合部署机制
          </h2>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed max-w-3xl">
          NodeMaster 采用 Master-Agent 架构。当您在面板添加节点后，可选择「同时部署探针与节点」或「仅部署探针」模式生成专属安装命令。脚本将自动检测 VPS 架构并在 30 秒内完成环境安装与守护进程注册，通过安全通道向主控端回传硬件与系统指标。
        </p>

        {/* 部署模式切换 */}
        <div>
          <label className="text-xs font-medium text-ink-secondary mb-1.5 block">
            选择部署模式:
          </label>
          <div className="grid grid-cols-2 max-w-md p-1 bg-paper border border-rule rounded-lg gap-1.5">
            <button
              type="button"
              onClick={() => setDeployMode("all")}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                deployMode === "all"
                  ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                  : "text-ink-secondary hover:text-ink hover:bg-paper-2 border border-transparent"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
              <span>同时部署探针与节点</span>
            </button>
            <button
              type="button"
              onClick={() => setDeployMode("probe_only")}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${
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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono text-ink-secondary">
              {deployMode === "all" ? "全量纳管指令格式 (内核+探针):" : "纯探针监控指令格式 (仅探针):"}
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

      {/* Script Source Preview */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-rule">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              install.sh 完整脚本源码预览
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              由主控端动态下发，兼容 Debian、Ubuntu、CentOS、Rocky Linux
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyScript}
            icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copied ? "已复制脚本" : "复制代码"}
          </Button>
        </div>

        <div className="relative rounded-md bg-paper border border-rule overflow-hidden">
          <pre className="p-4 text-xs font-mono text-ink-secondary overflow-x-auto max-h-[460px] leading-relaxed select-all">
            {scriptContent || "正在获取脚本源码..."}
          </pre>
        </div>
      </div>
    </div>
  );
};
