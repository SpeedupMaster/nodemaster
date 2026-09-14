import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select, SelectOption } from "../common/Select";
import { Input } from "../common/Input";
import { NodeItem } from "../../types";
import { ArrowsClockwise, ShieldCheck, Key, Globe, Sparkle } from "@phosphor-icons/react";

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (nodeData: any) => Promise<any>;
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
  const [country, setCountry] = useState("HK");
  const [countryName, setCountryName] = useState("中国香港");
  const [sni, setSni] = useState("www.microsoft.com");
  const [ssMethod, setSsMethod] = useState("2022-blake3-aes-128-gcm");
  const [ssPassword, setSsPassword] = useState(() =>
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  );
  const [trafficLimitGB, setTrafficLimitGB] = useState("1000");
  const [tagsStr, setTagsStr] = useState("主力直连, 原生IP, 千兆带宽");
  const [submitting, setSubmitting] = useState(false);

  const handleTypeChange = (newType: "direct" | "unlock") => {
    setType(newType);
    if (newType === "unlock") {
      setPort("8388");
      setCountry("US");
      setCountryName("美国洛杉矶");
      setTagsStr("原生住宅, Shadowsocks, 流媒体解锁, OpenAI");
    } else {
      setPort("443");
      setCountry("HK");
      setCountryName("中国香港");
      setTagsStr("主力直连, 原生IP, 千兆带宽");
    }
  };

  const handleRefreshKey = () => {
    const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    setSsPassword(key);
  };

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
        port: Number(port) || (type === "unlock" ? 8388 : 443),
        type,
        protocol: type === "unlock" ? "shadowsocks" : "vless-reality",
        country,
        countryName,
        trafficLimitBytes: Number(trafficLimitGB) * 1024 * 1024 * 1024,
        tags,
        sni: type === "direct" ? sni : undefined,
        ssMethod: type === "unlock" ? ssMethod : undefined,
        ssPassword: type === "unlock" ? ssPassword : undefined,
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
      desc: "客户端第一跳直连出口，部署 VLESS-Reality 高速免证书协议",
      badge: "高速直连",
    },
    {
      value: "unlock",
      label: "流媒体/AI 解锁机 (Unlock Node)",
      desc: "原生住宅 VPS，部署轻量 Shadowsocks 协议，专供海外链式解锁",
      badge: "SS 解锁",
    },
  ];

  const ssMethodOptions: SelectOption[] = [
    {
      value: "2022-blake3-aes-128-gcm",
      label: "2022-blake3-aes-128-gcm (推荐)",
      desc: "最新 Shadowsocks 2022 标准，极低 CPU 开销，吞吐速度最快",
      badge: "SS 2022",
    },
    {
      value: "aes-128-gcm",
      label: "aes-128-gcm (标准通用 AEAD)",
      desc: "全平台客户端与代理内核极佳兼容性",
      badge: "AEAD",
    },
    {
      value: "chacha20-ietf-poly1305",
      label: "chacha20-ietf-poly1305 (ARM 优化)",
      desc: "适合 ARM 架构 VPS 或低功耗小鸡运行",
      badge: "ARM 优化",
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
      subtitle={
        type === "unlock"
          ? "纳管原生解锁机，自动生成低开销 Shadowsocks 服务端配置"
          : "纳管主力直连机，自动生成 Xray-core Reality 免证书代理配置"
      }
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
            placeholder={
              type === "unlock"
                ? "例如: US-Residential-Unlock-02"
                : "例如: HK-BGP-Direct-02"
            }
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
              placeholder="例如: 154.23.189.90"
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

        {/* Node Topology Type Selection Cards */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1.5">
            节点拓扑类型 *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Direct Node */}
            <div
              onClick={() => handleTypeChange("direct")}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between select-none ${
                type === "direct"
                  ? "bg-accent/10 border-accent ring-1 ring-accent/40 shadow-sm"
                  : "bg-paper border-rule hover:border-rule-active hover:bg-paper-hover"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Globe
                      weight="bold"
                      className={`w-4 h-4 ${type === "direct" ? "text-accent" : "text-ink-muted"}`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        type === "direct" ? "text-ink" : "text-ink-secondary"
                      }`}
                    >
                      主力直连机
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-subtle text-accent border border-accent/20 font-mono whitespace-nowrap shrink-0">
                    高速直连
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted mt-2 leading-relaxed">
                  客户端第一跳直连出口，部署 VLESS-Reality 高速免证书协议
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-rule/50 flex items-center justify-between text-[10px] font-mono">
                <span className="text-accent font-medium">协议: VLESS-Reality</span>
                <span className="text-ink-muted">端口: 443</span>
              </div>
            </div>

            {/* Card 2: Unlock Node */}
            <div
              onClick={() => handleTypeChange("unlock")}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between select-none ${
                type === "unlock"
                  ? "bg-purple-950/20 border-purple-500 ring-1 ring-purple-500/40 shadow-sm"
                  : "bg-paper border-rule hover:border-rule-active hover:bg-paper-hover"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkle
                      weight="bold"
                      className={`w-4 h-4 ${type === "unlock" ? "text-purple-400" : "text-ink-muted"}`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        type === "unlock" ? "text-ink" : "text-ink-secondary"
                      }`}
                    >
                      流媒体/AI 解锁机
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-500/30 font-mono whitespace-nowrap shrink-0">
                    SS 解锁
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted mt-2 leading-relaxed">
                  原生住宅 VPS，部署轻量 Shadowsocks 协议，专供海外链式解锁
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-rule/50 flex items-center justify-between text-[10px] font-mono">
                <span className="text-purple-400 font-medium">协议: Shadowsocks</span>
                <span className="text-ink-muted">端口: 8388</span>
              </div>
            </div>
          </div>
        </div>

        {/* Region & Traffic Quota */}
        <div className="grid grid-cols-2 gap-3">
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

        {/* Dynamic Protocol Fields: Direct (Reality SNI) vs Unlock (Shadowsocks Key) */}
        {type === "direct" ? (
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
        ) : (
          <div className="space-y-3 p-3.5 rounded-lg bg-paper-3/40 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                Shadowsocks 解锁专用参数 (海外高速直达)
              </span>
              <span className="text-[10px] text-ink-muted font-mono">
                免去 Reality 握手开销
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                加密算法 (Cipher Method) *
              </label>
              <Select
                options={ssMethodOptions}
                value={ssMethod}
                onChange={(val) => setSsMethod(val)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-ink-muted">
                  连接密码 / Base64 密钥 *
                </label>
                <button
                  type="button"
                  onClick={handleRefreshKey}
                  className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-mono"
                >
                  <ArrowsClockwise className="w-3 h-3" />
                  生成随机密钥
                </button>
              </div>
              <Input
                required
                value={ssPassword}
                onChange={(e) => setSsPassword(e.target.value)}
                placeholder="Shadowsocks 密码或 Base64 密钥"
              />
            </div>

            <p className="text-[11px] text-ink-muted leading-relaxed">
              提示：解锁机仅与海外主力机通信，不穿越国内防火墙，因此采用高效的 Shadowsocks 协议即可，极大地节约 VPS 的 CPU 开销并带来更高的数据吞吐。
            </p>
          </div>
        )}

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
