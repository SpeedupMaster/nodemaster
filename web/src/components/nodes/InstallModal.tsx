import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { NodeItem } from "../../types";
import { Copy, Check, Terminal, ShieldCheck } from "@phosphor-icons/react";

interface InstallModalProps {
  node: NodeItem | null;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ node, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!node) return null;

  const panelHost = window.location.origin;
  const installCmd = `curl -fsSL ${panelHost}/api/install.sh | bash -s -- --panel ${panelHost} --token ${node.token}`;

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
      subtitle="在目标 VPS 的 root SSH 终端执行下方命令，将同时纳管代理节点与系统探针守护进程"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-md bg-paper-3/60 border border-rule flex items-start gap-2.5 text-xs text-ink-secondary">
          <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <span>安装脚本将自动检测 VPS 架构 (x86_64 / aarch64)，同时部署代理服务内核（Xray-core / Shadowsocks）与 NodeMaster 探针守护进程，实现免维护代理中继与实时硬件监控回传。</span>
          </div>
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
