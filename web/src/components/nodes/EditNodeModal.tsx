import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Input } from "../common/Input";
import { Select } from "../common/Select";
import { Button } from "../common/Button";
import { NodeItem } from "../../types";
import {
  Globe,
  Key,
  ArrowsClockwise,
} from "@phosphor-icons/react";

interface EditNodeModalProps {
  node: NodeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, updates: Partial<NodeItem>) => Promise<void> | void;
}

const countryOptions = [
  { value: "HK", label: "中国香港 (HK)", badge: "香港" },
  { value: "JP", label: "日本东京 (JP)", badge: "东京" },
  { value: "US", label: "美国洛杉矶 (US)", badge: "洛杉矶" },
  { value: "SG", label: "新加坡 (SG)", badge: "狮城" },
  { value: "TW", label: "中国台湾 (TW)", badge: "台北" },
  { value: "KR", label: "韩国首尔 (KR)", badge: "首尔" },
  { value: "DE", label: "德国法兰克福 (DE)", badge: "法兰克福" },
  { value: "GB", label: "英国伦敦 (GB)", badge: "伦敦" },
];

const ssMethodOptions = [
  {
    value: "2022-blake3-aes-128-gcm",
    label: "2022-blake3-aes-128-gcm",
    badge: "SS-2022 首选",
    desc: "16 字节 Base64 密钥，极低 CPU 占用与抗封锁重放",
  },
  {
    value: "2022-blake3-aes-256-gcm",
    label: "2022-blake3-aes-256-gcm",
    badge: "强安全",
    desc: "32 字节 Base64 密钥，最高等级加密安全",
  },
  {
    value: "aes-128-gcm",
    label: "aes-128-gcm",
    badge: "经典兼容",
    desc: "传统 AEAD 加密，全客户端通用兼容",
  },
];

export const EditNodeModal: React.FC<EditNodeModalProps> = ({
  node,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("443");
  const [country, setCountry] = useState("HK");
  const [countryName, setCountryName] = useState("中国香港");
  const [bandwidthMbps, setBandwidthMbps] = useState("1000");
  const [trafficLimitGB, setTrafficLimitGB] = useState("1000");
  const [trafficResetDay, setTrafficResetDay] = useState("1");
  const [sni, setSni] = useState("www.microsoft.com");
  const [ssMethod, setSsMethod] = useState("2022-blake3-aes-128-gcm");
  const [ssPassword, setSsPassword] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync state when node changes or modal opens
  useEffect(() => {
    if (node && isOpen) {
      setName(node.name || "");
      setIp(node.ip || "");
      setPort(String(node.port || (node.type === "unlock" ? 8388 : 443)));
      setCountry(node.country || "HK");
      setCountryName(node.countryName || "中国香港");
      setBandwidthMbps(String(node.bandwidthMbps || 1000));
      setTrafficLimitGB(
        String(Math.round((node.trafficLimitBytes || 1073741824000) / (1024 * 1024 * 1024)))
      );
      setTrafficResetDay(String(node.trafficResetDay || 1));
      setSni(node.reality?.serverName || node.sni || "www.microsoft.com");
      setSsMethod(node.shadowsocks?.method || "2022-blake3-aes-128-gcm");
      setSsPassword(node.shadowsocks?.password || "");
      setTagsStr(node.tags?.join(", ") || "");
    }
  }, [node, isOpen]);

  if (!node) return null;

  const isUnlock = node.type === "unlock" || node.protocol === "shadowsocks";

  const handleRefreshKey = () => {
    const is256 = ssMethod === "2022-blake3-aes-256-gcm";
    const bytes = new Uint8Array(is256 ? 32 : 16);
    crypto.getRandomValues(bytes);
    const key = btoa(String.fromCharCode(...bytes));
    setSsPassword(key);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ip.trim()) return;

    setSubmitting(true);
    try {
      const tags = tagsStr
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);

      await onSubmit(node.id, {
        name,
        ip,
        port: Number(port) || node.port,
        country,
        countryName,
        bandwidthMbps: Number(bandwidthMbps) || 1000,
        trafficLimitBytes: Number(trafficLimitGB) * 1024 * 1024 * 1024,
        trafficResetDay: Number(trafficResetDay) || 1,
        tags,
        sni: !isUnlock ? sni : undefined,
        shadowsocks: isUnlock
          ? {
              method: ssMethod,
              password: ssPassword,
            }
          : undefined,
      });

      onClose();
    } catch (err) {
      console.error("更新节点失败:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="编辑 VPS 节点配置"
      subtitle={`修改节点 ${node.name} 的网络连接属性与规格配额`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Node Profile Meta Bar */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-paper-3/50 border border-rule text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-ink-muted">节点 ID:</span>
            <span className="text-ink font-medium">{node.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded font-medium text-[10px] border ${
                isUnlock
                  ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                  : "bg-accent/10 text-accent border-accent/30"
              }`}
            >
              {isUnlock ? "流媒体解锁机 (Shadowsocks)" : "主力直连机 (VLESS-Reality)"}
            </span>
          </div>
        </div>

        {/* Node Name */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">
            节点标识名称 *
          </label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: HK-BGP-Direct-01"
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

        {/* Region & Bandwidth */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="h-5 flex items-center justify-between mb-1.5 min-w-0">
              <label className="text-xs font-medium text-ink-muted shrink-0 whitespace-nowrap">
                地理位置
              </label>
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { code: "HK", name: "中国香港", label: "HK" },
                  { code: "JP", name: "日本东京", label: "JP" },
                  { code: "US", name: "美国洛杉矶", label: "US" },
                  { code: "SG", name: "新加坡", label: "SG" },
                ].map((r) => {
                  const isActive = country === r.code;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => {
                        setCountry(r.code);
                        setCountryName(r.name);
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 whitespace-nowrap cursor-pointer transition-all border select-none ${
                        isActive
                          ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                          : "bg-paper-3 text-ink-secondary hover:text-ink hover:bg-paper-hover border-rule"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
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
            <div className="h-5 flex items-center justify-between mb-1.5 min-w-0">
              <label className="text-xs font-medium text-ink-muted shrink-0 whitespace-nowrap">
                标称峰值带宽
              </label>
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { label: "500M", val: "500" },
                  { label: "1Gbps", val: "1000" },
                  { label: "2.5G", val: "2500" },
                  { label: "10G", val: "10000" },
                ].map((p) => {
                  const isActive = bandwidthMbps === p.val;
                  return (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setBandwidthMbps(p.val)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 whitespace-nowrap cursor-pointer transition-all border select-none ${
                        isActive
                          ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                          : "bg-paper-3 text-ink-secondary hover:text-ink hover:bg-paper-hover border-rule"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              type="number"
              value={bandwidthMbps}
              onChange={(e) => setBandwidthMbps(e.target.value)}
              placeholder="1000"
              suffixText="Mbps"
            />
          </div>
        </div>

        {/* Traffic Quota & Reset Day */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="h-5 flex items-center justify-between mb-1.5 min-w-0">
              <label className="text-xs font-medium text-ink-muted shrink-0 whitespace-nowrap">
                月度流量配额
              </label>
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { label: "500G", val: "500" },
                  { label: "1T", val: "1000" },
                  { label: "2T", val: "2000" },
                  { label: "5T", val: "5000" },
                ].map((q) => {
                  const isActive = trafficLimitGB === q.val;
                  return (
                    <button
                      key={q.val}
                      type="button"
                      onClick={() => setTrafficLimitGB(q.val)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 whitespace-nowrap cursor-pointer transition-all border select-none ${
                        isActive
                          ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                          : "bg-paper-3 text-ink-secondary hover:text-ink hover:bg-paper-hover border-rule"
                      }`}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              type="number"
              value={trafficLimitGB}
              onChange={(e) => setTrafficLimitGB(e.target.value)}
              placeholder="1000"
              suffixText="GB"
            />
          </div>

          <div>
            <div className="h-5 flex items-center justify-between mb-1.5 min-w-0">
              <label className="text-xs font-medium text-ink-muted shrink-0 whitespace-nowrap">
                流量重置日
              </label>
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { label: "1日", val: "1" },
                  { label: "15日", val: "15" },
                  { label: "28日", val: "28" },
                ].map((d) => {
                  const isActive = trafficResetDay === d.val;
                  return (
                    <button
                      key={d.val}
                      type="button"
                      onClick={() => setTrafficResetDay(d.val)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 whitespace-nowrap cursor-pointer transition-all border select-none ${
                        isActive
                          ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                          : "bg-paper-3 text-ink-secondary hover:text-ink hover:bg-paper-hover border-rule"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              type="number"
              min={1}
              max={31}
              value={trafficResetDay}
              onChange={(e) => setTrafficResetDay(e.target.value)}
              placeholder="1"
              suffixText="日"
            />
          </div>
        </div>

        {/* Dynamic Protocol Fields: Direct (Reality SNI) vs Unlock (Shadowsocks Key) */}
        {!isUnlock ? (
          <div>
            <div className="h-5 flex items-center justify-between mb-1.5 min-w-0">
              <label className="text-xs font-medium text-ink-muted shrink-0 whitespace-nowrap">
                SNI 伪装域名 (Server Name Indication) *
              </label>
              <div className="flex items-center gap-1 shrink-0">
                {[
                  "www.microsoft.com",
                  "www.apple.com",
                  "addons.mozilla.org",
                  "gateway.icloud.com",
                  "itunes.apple.com",
                ].map((domain) => {
                  const isActive = sni === domain;
                  return (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => setSni(domain)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 whitespace-nowrap cursor-pointer transition-all border select-none ${
                        isActive
                          ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                          : "bg-paper-3 text-ink-secondary hover:text-accent hover:border-accent/40 border-rule"
                      }`}
                    >
                      {domain.split(".")[1] || domain}
                    </button>
                  );
                })}
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
              修改后将同步更新客户端 VLESS 连接与 Xray 服务端握手借用域名
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-3.5 rounded-lg bg-paper-3/40 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                Shadowsocks 解锁专用参数
              </span>
              <span className="text-[10px] text-ink-muted font-mono">
                海外链式转发专供
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
                  重新生成密钥
                </button>
              </div>
              <Input
                required
                value={ssPassword}
                onChange={(e) => setSsPassword(e.target.value)}
                placeholder="Shadowsocks 密码或 Base64 密钥"
              />
            </div>
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
            保存修改
          </Button>
        </div>
      </form>
    </Modal>
  );
};
