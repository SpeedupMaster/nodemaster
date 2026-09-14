import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { NodeItem } from "../../types";
import { Copy, Check } from "@phosphor-icons/react";

interface ConfigModalProps {
  node: NodeItem | null;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ node, onClose }) => {
  const [configJson, setConfigJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!node) return;
    setLoading(true);
    fetch(`/api/nodes/${node.id}/xray-config`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setConfigJson(JSON.stringify(res.data, null, 2));
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [node]);

  if (!node) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(configJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={!!node}
      onClose={onClose}
      title={`${node.name} - Xray 服务端配置`}
      subtitle="VPS 节点 /etc/xray/config.json 完整配置定义 (支持热重载)"
      maxWidth="xl"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-muted font-mono">
            协议: {node.protocol.toUpperCase()} • 端口: {node.port}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copied ? "已复制到剪贴板" : "复制完整配置"}
          </Button>
        </div>

        <div className="relative rounded-md bg-paper border border-rule overflow-hidden">
          <pre className="p-4 text-xs font-mono text-ink-secondary overflow-x-auto max-h-[420px] leading-relaxed">
            {loading ? "正在从主控组装 Xray 配置..." : configJson}
          </pre>
        </div>
      </div>
    </Modal>
  );
};
