import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { NodeItem } from "../../types";
import { Copy, Check, Terminal, ShieldCheck, Pulse, Cpu } from "@phosphor-icons/react";

interface InstallModalProps {
  node: NodeItem | null;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ node, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [deployMode, setDeployMode] = useState<"all" | "probe_only">("all");

  if (!node) return null;

  const panelHost = window.location.origin;
  const installCmd =
    deployMode === "probe_only"
      ? `curl -fsSL ${panelHost}/api/install.sh | bash -s -- --panel ${panelHost} --token ${node.token} --probe-only`
      : `curl -fsSL ${panelHost}/api/install.sh | bash -s -- --panel ${panelHost} --token ${node.token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={!!node}
      onClose={onClose}
      title={`${node.name} - VPS 一键上线与探针部署`}
      subtitle="在目标 VPS 的 root SSH 终端执行下方命令，完成节点与监控上线"
      maxWidth="lg"
    >
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
              className={`py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                deployMode === "all"
                  ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                  : "text-ink-secondary hover:text-ink hover:bg-paper-2 border border-transparent"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
              <span>同时部署探针与节点</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                deployMode === "all" ? "bg-accent/25 text-accent" : "bg-paper-3 text-ink-muted"
              }`}>
                全量纳管
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDeployMode("probe_only")}
              className={`py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                deployMode === "probe_only"
                  ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                  : "text-ink-secondary hover:text-ink hover:bg-paper-2 border border-transparent"
              }`}
            >
              <Pulse className="w-3.5 h-3.5 flex-shrink-0" />
              <span>仅部署探针</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                deployMode === "probe_only" ? "bg-accent/25 text-accent" : "bg-paper-3 text-ink-muted"
              }`}>
                纯监控
              </span>
            </button>
          </div>
        </div>

        {/* 模式说明卡片 */}
        <div className="p-3 rounded-md bg-paper-3/60 border border-rule flex items-start gap-2.5 text-xs text-ink-secondary">
          {deployMode === "all" ? (
            <>
              <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <span>
                  安装脚本将自动检测 VPS 架构 (x86_64 / aarch64)，同时部署代理服务内核（Xray-core / Shadowsocks）与 NodeMaster 探针守护进程，实现免维护代理中继与实时硬件监控回传。
                </span>
              </div>
            </>
          ) : (
            <>
              <Pulse className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <span>
                  仅部署 NodeMaster 探针守护进程，实时回传 CPU、内存、磁盘与双向网络速率等硬件指标。不下载或启动代理内核，不占用代理端口，适合纯监控场景。
                </span>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-ink flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-accent" />
              一键执行命令
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copied ? "已复制命令" : "复制命令"}
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
    </Modal>
  );
};
