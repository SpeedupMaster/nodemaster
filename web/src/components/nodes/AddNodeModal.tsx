import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { NodeItem } from "../../types";

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (nodeData: Partial<NodeItem>) => Promise<any>;
}

export const AddNodeModal: React.FC<AddNodeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("443");
  const [type, setType] = useState<"exit" | "transit">("exit");
  const [protocol, setProtocol] = useState<"vless-reality" | "dokodemo">("vless-reality");
  const [country, setCountry] = useState("HK");
  const [countryName, setCountryName] = useState("中国香港");
  const [sni, setSni] = useState("www.microsoft.com");
  const [trafficLimitGB, setTrafficLimitGB] = useState("1000");
  const [tagsStr, setTagsStr] = useState("原生IP, 流媒体解锁");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ip) return;

    setSubmitting(true);
    try {
      const tags = tagsStr
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);

      await onSubmit({
        name,
        ip,
        port: Number(port) || 443,
        type,
        protocol: type === "transit" ? "dokodemo" : protocol,
        country,
        countryName,
        trafficLimitBytes: Number(trafficLimitGB) * 1024 * 1024 * 1024,
        tags,
        sni: type === "exit" ? sni : undefined,
      });

      // Reset form
      setName("");
      setIp("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const countries = [
    { code: "HK", name: "中国香港" },
    { code: "JP", name: "日本东京" },
    { code: "US", name: "美国洛杉矶" },
    { code: "SG", name: "新加坡" },
    { code: "DE", name: "德国法兰克福" },
    { code: "CN", name: "中国内地 (中转)" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="添加新的 VPS 节点"
      subtitle="纳管一台新的 VPS 并自动生成 Xray-core Reality 免证书代理配置"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Node Name */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">
            节点标识名称 *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: HK-BGP-Reality-02"
            className="w-full px-3 py-2 rounded-md bg-paper border border-rule focus:border-accent focus:outline-none text-ink font-mono text-xs"
          />
        </div>

        {/* IP & Port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-muted mb-1">
              公网 IP 地址 *
            </label>
            <input
              type="text"
              required
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="例如: 103.145.75.88"
              className="w-full px-3 py-2 rounded-md bg-paper border border-rule focus:border-accent focus:outline-none text-ink font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              服务端口
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-paper border border-rule focus:border-accent focus:outline-none text-ink font-mono text-xs"
            />
          </div>
        </div>

        {/* Node Type & Region */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              节点拓扑类型
            </label>
            <select
              value={type}
              onChange={(e) => {
                const t = e.target.value as "exit" | "transit";
                setType(t);
                if (t === "transit") setProtocol("dokodemo");
                else setProtocol("vless-reality");
              }}
              className="w-full px-3 py-2 rounded-md bg-paper border border-rule focus:border-accent focus:outline-none text-ink text-xs"
            >
              <option value="exit">海外落地机 (Exit Node)</option>
              <option value="transit">前置中转机 (Transit Node)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              地理位置
            </label>
            <select
              value={country}
              onChange={(e) => {
                const c = countries.find((item) => item.code === e.target.value);
                setCountry(e.target.value);
                if (c) setCountryName(c.name);
              }}
              className="w-full px-3 py-2 rounded-md bg-paper border border-rule focus:border-accent focus:outline-none text-ink text-xs"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Protocol & Quota */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              底层协议
            </label>
            <input
              type="text"
              disabled
              value={type === "transit" ? "Dokodemo-door (中继转发)" : "VLESS-Reality (Vision/XTLS)"}
              className="w-full px-3 py-2 rounded-md bg-paper-3 border border-rule text-ink-secondary text-xs cursor-not-allowed font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              月度流量配额 (GB)
            </label>
            <input
              type="number"
              value={trafficLimitGB}
              onChange={(e) => setTrafficLimitGB(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-paper border border-rule focus:border-accent focus:outline-none text-ink font-mono text-xs"
            />
          </div>
        </div>

        {/* SNI (Server Name Indication) for Reality Exit Nodes */}
        {type === "exit" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-ink-muted">
                SNI 伪装域名 (Server Name Indication) *
              </label>
              <div className="flex items-center gap-1">
                {[
                  "www.microsoft.com",
                  "www.apple.com",
                  "addons.mozilla.org",
                  "gateway.icloud.com",
                  "itunes.apple.com",
                ].map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => setSni(domain)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 text-ink-secondary hover:text-accent hover:border-accent/40 border border-rule transition-colors font-mono"
                  >
                    {domain.split(".")[1] || domain}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              required
              value={sni}
              onChange={(e) => setSni(e.target.value)}
              placeholder="例如: www.microsoft.com"
              className="w-full px-3 py-2 rounded-md bg-paper border border-rule focus:border-accent focus:outline-none text-ink font-mono text-xs"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              VLESS-Reality 握手借用的合规 TLS 域名（需支持 TLS 1.3 及 H2，无须您拥有该域名证书）
            </p>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">
            标签 (以逗号分隔)
          </label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="原生IP, 流媒体解锁, OpenAI"
            className="w-full px-3 py-2 rounded-md bg-paper border border-rule focus:border-accent focus:outline-none text-ink text-xs"
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-rule flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={submitting}>
            立即生成并上线
          </Button>
        </div>
      </form>
    </Modal>
  );
};
