import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select, SelectOption } from "../common/Select";
import { Input } from "../common/Input";
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
  const [type, setType] = useState<"direct" | "unlock">("direct");
  const [protocol, setProtocol] = useState<"vless-reality">("vless-reality");
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
        protocol,
        country,
        countryName,
        trafficLimitBytes: Number(trafficLimitGB) * 1024 * 1024 * 1024,
        tags,
        sni,
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

  const typeOptions: SelectOption[] = [
    {
      value: "direct",
      label: "主力直连机 (Direct Node)",
      desc: "部署 VLESS-Reality 高速直连，作为客户端主要连接节点",
      badge: "高速直连",
    },
    {
      value: "unlock",
      label: "流媒体/AI 解锁机 (Unlock Node)",
      desc: "原生住宅/干净 IP，用于在链式代理中专属解锁 Netflix、ChatGPT 等",
      badge: "原生解锁",
    },
  ];

  const countryOptions: SelectOption[] = [
    { value: "HK", label: "中国香港 (HK)", badge: "香港" },
    { value: "JP", label: "日本东京 (JP)", badge: "日本" },
    { value: "US", label: "美国洛杉矶 (US)", badge: "美国" },
    { value: "GB", label: "英国伦敦 (GB)", badge: "英国" },
    { value: "SG", label: "新加坡 (SG)", badge: "新加坡" },
    { value: "DE", label: "德国法兰克福 (DE)", badge: "德国" },
    { value: "CN", label: "中国内地 (CN)", badge: "内地" },
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
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: HK-BGP-Reality-02"
          />
        </div>

        {/* IP & Port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-muted mb-1">
              公网 IP 地址 *
            </label>
            <Input
              required
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="例如: 103.145.75.88"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              服务端口
            </label>
            <Input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              suffixText="端口"
            />
          </div>
        </div>

        {/* Node Type & Region */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              节点拓扑类型
            </label>
            <Select
              options={typeOptions}
              value={type}
              onChange={(val) => setType(val as "direct" | "unlock")}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              地理位置
            </label>
            <Select
              options={countryOptions}
              value={country}
              onChange={(val) => {
                const c = countryOptions.find((item) => item.value === val);
                setCountry(val);
                if (c) setCountryName(c.label.split(" ")[0]);
              }}
            />
          </div>
        </div>

        {/* Protocol & Quota */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              底层协议
            </label>
            <Input
              disabled
              value="VLESS-Reality (Vision/XTLS)"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              月度流量配额 (GB)
            </label>
            <Input
              type="number"
              value={trafficLimitGB}
              onChange={(e) => setTrafficLimitGB(e.target.value)}
              suffixText="GB"
            />
          </div>
        </div>

        {/* SNI (Server Name Indication) */}
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
                  className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 text-ink-secondary hover:text-accent hover:border-accent/40 border border-rule transition-colors font-mono cursor-pointer"
                >
                  {domain.split(".")[1] || domain}
                </button>
              ))}
            </div>
          </div>
          <Input
            required
            value={sni}
            onChange={(e) => setSni(e.target.value)}
            placeholder="例如: www.microsoft.com"
            suffixText="SNI"
          />
          <p className="text-[11px] text-ink-muted mt-1">
            VLESS-Reality 握手借用的合规 TLS 域名（需支持 TLS 1.3 及 H2，无须您拥有该域名证书）
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">
            标签 (以逗号分隔)
          </label>
          <Input
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="原生IP, 流媒体解锁, OpenAI"
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
