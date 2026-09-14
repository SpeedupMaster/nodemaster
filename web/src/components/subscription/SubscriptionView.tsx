import React, { useState, useEffect } from "react";
import { SubscriptionToken, NodeItem } from "../../types";
import { Button } from "../common/Button";
import {
  LinkSimple,
  Copy,
  Check,
  DownloadSimple,
  QrCode,
  Lightning,
  Sparkle,
  DeviceMobile,
} from "@phosphor-icons/react";

interface SubscriptionViewProps {
  subscriptions: SubscriptionToken[];
  nodes: NodeItem[];
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  subscriptions,
  nodes,
}) => {
  const [selectedSubToken, setSelectedSubToken] = useState<string>("");
  const [format, setFormat] = useState<"clash" | "singbox" | "base64">("clash");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  const activeSub =
    subscriptions.find((s) => s.token === selectedSubToken) ||
    subscriptions[0];

  useEffect(() => {
    if (subscriptions.length > 0 && !selectedSubToken) {
      setSelectedSubToken(subscriptions[0].token);
    }
  }, [subscriptions, selectedSubToken]);

  const subUrl = activeSub
    ? `${window.location.origin}/api/sub/${activeSub.token}`
    : "";

  // Fetch preview when activeSub or format changes
  useEffect(() => {
    if (!activeSub) return;
    setLoadingPreview(true);
    fetch(`/api/sub/${activeSub.token}?format=${format}`)
      .then((r) => r.text())
      .then((txt) => setPreviewContent(txt))
      .catch((e) => console.error(e))
      .finally(() => setLoadingPreview(false));
  }, [activeSub, format]);

  const handleCopyLink = () => {
    if (!subUrl) return;
    navigator.clipboard.writeText(subUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyContent = () => {
    if (!previewContent) return;
    navigator.clipboard.writeText(previewContent);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const handleDownload = () => {
    const ext = format === "clash" ? "yaml" : format === "singbox" ? "json" : "txt";
    const blob = new Blob([previewContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nodemaster_${activeSub?.name || "nodes"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const oneClickClashUrl = `clash://install-config?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent("NodeMaster")}`;

  return (
    <div className="space-y-6">
      {/* Universal Subscription Hero Card */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LinkSimple weight="bold" className="w-5 h-5 text-accent" />
              <h2 className="text-base font-semibold text-ink">
                全客户端通用智能订阅链接
              </h2>
            </div>
            <p className="text-xs text-ink-muted mt-1 max-w-xl">
              服务端将依据客户端的 User-Agent 自动自适应下发对应的配置（Clash Meta / Mihomo、Sing-box、Shadowrocket、V2RayN），无需手动转换。
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={oneClickClashUrl}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-accent text-paper font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm"
            >
              <Sparkle weight="fill" className="w-3.5 h-3.5" />
              一键导入 Clash / Mihomo
            </a>
          </div>
        </div>

        {/* URL Box */}
        <div className="mt-4 p-3 rounded-lg bg-paper border border-rule flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-ink-secondary truncate select-all">
            {subUrl || "加载中..."}
          </span>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
              icon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedLink ? "已复制链接" : "复制订阅链接"}
            </Button>
          </div>
        </div>
      </div>

      {/* Subscription Format Switcher & Live Preview */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rule">
          <div className="flex items-center gap-1 bg-paper p-1 rounded-md border border-rule">
            {[
              { id: "clash", label: "Clash Meta / Mihomo (YAML)" },
              { id: "singbox", label: "Sing-box (JSON)" },
              { id: "base64", label: "Shadowrocket / 通用 (Base64)" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFormat(item.id as any)}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  format === item.id
                    ? "bg-paper-2 text-ink shadow-sm border border-rule"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyContent}
              icon={copiedContent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedContent ? "已复制配置内容" : "复制内容"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              icon={<DownloadSimple className="w-3.5 h-3.5" />}
            >
              下载配置文件
            </Button>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="relative rounded-md bg-paper border border-rule overflow-hidden">
          <div className="px-4 py-2 bg-paper-3/40 border-b border-rule flex items-center justify-between text-[11px] font-mono text-ink-muted">
            <span>实时渲染结果 ({format.toUpperCase()})</span>
            <span>自适应规则分流 • TUN/Fake-IP 预设</span>
          </div>

          <pre className="p-4 text-xs font-mono text-ink-secondary overflow-x-auto max-h-[480px] leading-relaxed select-all">
            {loadingPreview ? "正在生成配置预览..." : previewContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
