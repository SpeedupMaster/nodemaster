import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { RoutingRule, NodeItem } from "../../types";
import {
  ShieldCheck,
  Lightning,
  TreeStructure,
  Lock,
  Globe,
  Tag,
  Check,
  Plus,
  Trash,
  Copy,
  ArrowsSplit,
  Eye,
  Terminal,
} from "@phosphor-icons/react";

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Partial<RoutingRule>) => Promise<any>;
  rule: RoutingRule | null;
  nodes: NodeItem[];
}

const POPULAR_GEOSITES = [
  { id: "openai", label: "OpenAI / ChatGPT", icon: "🤖" },
  { id: "anthropic", label: "Claude / Anthropic", icon: "🔮" },
  { id: "netflix", label: "Netflix 奈飞", icon: "🍿" },
  { id: "disney", label: "Disney+ 迪士尼", icon: "🏰" },
  { id: "youtube", label: "YouTube 视频", icon: "▶️" },
  { id: "spotify", label: "Spotify 音乐", icon: "🎵" },
  { id: "tiktok", label: "TikTok 国际版", icon: "📱" },
  { id: "telegram", label: "Telegram 电报", icon: "💬" },
  { id: "google", label: "Google 谷歌", icon: "🔍" },
  { id: "github", label: "GitHub 代码托管", icon: "🐙" },
  { id: "steam", label: "Steam 游戏", icon: "🎮" },
  { id: "cn", label: "中国大陆 (CN)", icon: "🇨🇳" },
  { id: "private", label: "局域网 (Private)", icon: "🔒" },
];

const POPULAR_GEOIPS = [
  { id: "cn", label: "中国大陆 (CN)", icon: "🇨🇳" },
  { id: "private", label: "局域网私网", icon: "🏠" },
  { id: "telegram", label: "Telegram IP", icon: "✈️" },
  { id: "us", label: "美国 (US)", icon: "🇺🇸" },
  { id: "hk", label: "中国香港 (HK)", icon: "🇭🇰" },
  { id: "jp", label: "日本 (JP)", icon: "🇯🇵" },
];

const PROTOCOL_OPTIONS = [
  { id: "bittorrent", label: "BitTorrent (P2P)" },
  { id: "http", label: "HTTP" },
  { id: "tls", label: "TLS" },
  { id: "quic", label: "QUIC" },
  { id: "dns", label: "DNS" },
];

export const RuleModal: React.FC<RuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  rule,
  nodes,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [targetOutbound, setTargetOutbound] = useState<"DIRECT" | "BLOCK" | "UNLOCK_OUT" | "PROXY">("DIRECT");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [geosite, setGeosite] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [geoip, setGeoip] = useState<string[]>([]);
  const [ips, setIps] = useState<string[]>([]);
  const [ipInput, setIpInput] = useState("");
  const [protocol, setProtocol] = useState<string[]>([]);
  const [port, setPort] = useState("");
  const [scopeType, setScopeType] = useState<"all" | "custom">("all");
  const [inboundNodeIds, setInboundNodeIds] = useState<string[]>([]);

  const [previewTab, setPreviewTab] = useState<"xray" | "clash" | "singbox">("xray");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize form state
  useEffect(() => {
    if (rule) {
      setName(rule.name || "");
      setDescription(rule.description || "");
      setEnabled(rule.enabled !== false);
      setTargetOutbound(rule.targetOutbound || "DIRECT");
      setTargetNodeId(rule.targetNodeId || "");
      setGeosite(rule.geosite || []);
      setDomains(rule.domains || []);
      setGeoip(rule.geoip || []);
      setIps(rule.ips || []);
      setProtocol(rule.protocol || []);
      setPort(rule.port || "");
      if (rule.inboundNodeIds && rule.inboundNodeIds.length > 0) {
        setScopeType("custom");
        setInboundNodeIds(rule.inboundNodeIds);
      } else {
        setScopeType("all");
        setInboundNodeIds([]);
      }
    } else {
      setName("");
      setDescription("");
      setEnabled(true);
      setTargetOutbound("DIRECT");
      setTargetNodeId("");
      setGeosite([]);
      setDomains([]);
      setGeoip([]);
      setIps([]);
      setProtocol([]);
      setPort("");
      setScopeType("all");
      setInboundNodeIds([]);
    }
    setDomainInput("");
    setIpInput("");
  }, [rule, isOpen]);

  // Geosite toggle
  const toggleGeosite = (id: string) => {
    setGeosite((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // GeoIP toggle
  const toggleGeoip = (id: string) => {
    setGeoip((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Protocol toggle
  const toggleProtocol = (id: string) => {
    setProtocol((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Domain tags handlers
  const handleAddDomain = () => {
    const trimmed = domainInput.trim().toLowerCase();
    if (!trimmed) return;
    const parts = trimmed.split(/[\s,]+/);
    const valid = parts.filter((p) => p && !domains.includes(p));
    if (valid.length > 0) {
      setDomains((prev) => [...prev, ...valid]);
    }
    setDomainInput("");
  };

  const removeDomain = (d: string) => {
    setDomains((prev) => prev.filter((item) => item !== d));
  };

  // IP tags handlers
  const handleAddIp = () => {
    const trimmed = ipInput.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[\s,]+/);
    const valid = parts.filter((p) => p && !ips.includes(p));
    if (valid.length > 0) {
      setIps((prev) => [...prev, ...valid]);
    }
    setIpInput("");
  };

  const removeIp = (ip: string) => {
    setIps((prev) => prev.filter((item) => item !== ip));
  };

  // Inbound nodes scope toggle
  const toggleNodeScope = (nodeId: string) => {
    setInboundNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  };

  // Real-time Preview computation
  const getCompiledPreview = () => {
    const cleanDomains = [
      ...geosite.map((g) => (g.startsWith("geosite:") ? g : `geosite:${g}`)),
      ...domains.map((d) => (d.includes(":") ? d : `domain:${d}`)),
    ];
    const cleanIps = [
      ...geoip.map((g) => (g.startsWith("geoip:") ? g : `geoip:${g}`)),
      ...ips,
    ];

    if (previewTab === "xray") {
      const ruleObj: any = {
        type: "field",
        outboundTag: targetOutbound,
      };
      if (cleanDomains.length > 0) ruleObj.domain = cleanDomains;
      if (cleanIps.length > 0) ruleObj.ip = cleanIps;
      if (protocol.length > 0) ruleObj.protocol = protocol;
      if (port.trim()) ruleObj.port = port.trim();
      return JSON.stringify(ruleObj, null, 2);
    }

    if (previewTab === "clash") {
      const clashTarget =
        targetOutbound === "DIRECT"
          ? "DIRECT"
          : targetOutbound === "BLOCK"
          ? "REJECT"
          : targetOutbound === "UNLOCK_OUT"
          ? "🤖 AI & 流媒体解锁"
          : "🚀 节点选择";

      const lines: string[] = [];
      domains.forEach((d) => {
        lines.push(`DOMAIN-SUFFIX,${d.replace(/^domain:/, "").replace(/^\*\./, "")},${clashTarget}`);
      });
      geosite.forEach((g) => {
        lines.push(`GEOSITE,${g.replace(/^geosite:/, "")},${clashTarget}`);
      });
      geoip.forEach((g) => {
        lines.push(`GEOIP,${g.replace(/^geoip:/, "").toUpperCase()},${clashTarget}`);
      });
      ips.forEach((ip) => {
        lines.push(`IP-CIDR,${ip},${clashTarget},no-resolve`);
      });
      if (protocol.includes("bittorrent")) {
        lines.push(`PROCESS-NAME,BitTorrent,${clashTarget}`);
      }
      if (lines.length === 0) lines.push(`MATCH,${clashTarget}`);
      return lines.join("\n");
    }

    // Sing-box
    const sRule: any = {
      outbound: targetOutbound.toLowerCase(),
    };
    if (geosite.length > 0) sRule.geosite = geosite;
    if (domains.length > 0) sRule.domain_suffix = domains;
    if (geoip.length > 0) sRule.geoip = geoip;
    if (ips.length > 0) sRule.ip_cidr = ips;
    if (port.trim()) sRule.port = port.trim();
    return JSON.stringify(sRule, null, 2);
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(getCompiledPreview());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const ruleData: Partial<RoutingRule> = {
        name: name.trim(),
        description: description.trim(),
        enabled,
        targetOutbound,
        targetNodeId: targetOutbound === "PROXY" ? targetNodeId : undefined,
        geosite,
        domains,
        geoip,
        ips,
        protocol,
        port: port.trim(),
        inboundNodeIds: scopeType === "all" ? [] : inboundNodeIds,
      };
      await onSave(ruleData);
      onClose();
    } catch (err) {
      console.error("Failed to save routing rule:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rule ? "编辑分流规则" : "新建可视化分流规则"}
      subtitle="直观配置域名、IP 与协议匹配条件，自由分配出口动作并实时语法预览"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Basic Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ink uppercase tracking-wider">
              基本信息与状态
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-ink-muted">
                {enabled ? "规则生效中" : "已停用"}
              </span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  enabled ? "bg-accent" : "bg-paper-3 border border-rule"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                规则名称 *
              </label>
              <Input
                placeholder="如: OpenAI & ChatGPT 智能分流"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                描述备注 (可选)
              </label>
              <Input
                placeholder="如: 自动路由至美国家宽解锁出口"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 2. Outbound Action Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink uppercase tracking-wider block">
            分流出口动作 (Target Outbound)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* DIRECT */}
            <button
              type="button"
              onClick={() => setTargetOutbound("DIRECT")}
              className={`p-3 rounded-lg border text-left transition-all relative ${
                targetOutbound === "DIRECT"
                  ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm"
                  : "bg-paper-3 border-rule hover:border-ink-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  DIRECT
                </span>
                {targetOutbound === "DIRECT" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
                )}
              </div>
              <div className="text-xs font-medium text-ink">直连直通</div>
              <div className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                本地网络直达，低延迟无损
              </div>
            </button>

            {/* BLOCK */}
            <button
              type="button"
              onClick={() => setTargetOutbound("BLOCK")}
              className={`p-3 rounded-lg border text-left transition-all relative ${
                targetOutbound === "BLOCK"
                  ? "bg-rose-500/10 border-rose-500/40 shadow-sm"
                  : "bg-paper-3 border-rule hover:border-ink-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-rose-400 font-mono">
                  BLOCK
                </span>
                {targetOutbound === "BLOCK" && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 ring-2 ring-rose-400/30" />
                )}
              </div>
              <div className="text-xs font-medium text-ink">阻断拦截</div>
              <div className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                黑洞丢弃，防 BT 封号与爬虫
              </div>
            </button>

            {/* UNLOCK_OUT */}
            <button
              type="button"
              onClick={() => setTargetOutbound("UNLOCK_OUT")}
              className={`p-3 rounded-lg border text-left transition-all relative ${
                targetOutbound === "UNLOCK_OUT"
                  ? "bg-purple-500/10 border-purple-500/40 shadow-sm"
                  : "bg-paper-3 border-rule hover:border-ink-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-purple-400 font-mono">
                  UNLOCK_OUT
                </span>
                {targetOutbound === "UNLOCK_OUT" && (
                  <span className="w-2 h-2 rounded-full bg-purple-400 ring-2 ring-purple-400/30" />
                )}
              </div>
              <div className="text-xs font-medium text-ink">落地解锁机</div>
              <div className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                链式绑定出口，AI/流媒体专用
              </div>
            </button>

            {/* PROXY */}
            <button
              type="button"
              onClick={() => setTargetOutbound("PROXY")}
              className={`p-3 rounded-lg border text-left transition-all relative ${
                targetOutbound === "PROXY"
                  ? "bg-accent/10 border-accent/40 shadow-sm"
                  : "bg-paper-3 border-rule hover:border-ink-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-accent font-mono">
                  PROXY
                </span>
                {targetOutbound === "PROXY" && (
                  <span className="w-2 h-2 rounded-full bg-accent ring-2 ring-accent/30" />
                )}
              </div>
              <div className="text-xs font-medium text-ink">节点代理</div>
              <div className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                指定代理节点或客户端自选
              </div>
            </button>
          </div>

          {/* PROXY target node selector */}
          {targetOutbound === "PROXY" && (
            <div className="mt-2 p-3 bg-paper-3/70 border border-rule rounded-lg">
              <label className="text-xs text-ink-secondary font-medium block mb-1.5">
                指定目标代理出口节点 (可选，默认使用中继拓扑配置)
              </label>
              <select
                value={targetNodeId}
                onChange={(e) => setTargetNodeId(e.target.value)}
                className="w-full bg-paper border border-rule rounded-md px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-accent"
              >
                <option value="">跟随拓扑配置 / 客户端自选出口</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.ip} · {n.countryName})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 3. Matching Conditions Builder */}
        <div className="space-y-4 border-t border-rule pt-4">
          <div className="flex items-center gap-2">
            <ArrowsSplit className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-ink uppercase tracking-wider">
              匹配规则条件 (支持组合，多条件为“或”匹配)
            </span>
          </div>

          {/* Condition A: Geosite quick select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-secondary">
                1. Geosite 常用分类库 (点选即生效)
              </span>
              <span className="text-[11px] text-ink-muted font-mono">
                已选 {geosite.length} 项
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_GEOSITES.map((item) => {
                const active = geosite.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleGeosite(item.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 border ${
                      active
                        ? "bg-accent text-paper font-semibold border-accent shadow-sm"
                        : "bg-paper-3 text-ink-secondary hover:text-ink hover:bg-paper-hover border-rule"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {active && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Condition B: Custom Domains tags input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-ink-secondary block">
              2. 自定义域名列表 (支持泛域名，如 `openai.com` 或 `*.claude.ai`)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddDomain();
                  }
                }}
                placeholder="输入域名，按回车或逗号快速添加..."
                className="flex-1 bg-paper border border-rule rounded-md px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
              />
              <Button type="button" variant="secondary" onClick={handleAddDomain}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                添加域名
              </Button>
            </div>

            {domains.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-paper/60 border border-rule/60 rounded-md">
                {domains.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper-3 border border-rule text-xs font-mono text-ink"
                  >
                    <Globe className="w-3 h-3 text-accent" />
                    <span>{d}</span>
                    <button
                      type="button"
                      onClick={() => removeDomain(d)}
                      className="ml-1 text-ink-muted hover:text-rose-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Condition C: GeoIP & CIDR IP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-secondary">
                3. IP 规则 (GeoIP 标签池 与 自定义 CIDR 网段)
              </span>
              <span className="text-[11px] text-ink-muted font-mono">
                GeoIP ({geoip.length}) · CIDR ({ips.length})
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {POPULAR_GEOIPS.map((item) => {
                const active = geoip.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleGeoip(item.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 border ${
                      active
                        ? "bg-accent text-paper font-semibold border-accent"
                        : "bg-paper-3 text-ink-secondary hover:text-ink hover:bg-paper-hover border-rule"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {active && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddIp();
                  }
                }}
                placeholder="如 192.168.0.0/16 或 10.0.0.0/8，按回车添加..."
                className="flex-1 bg-paper border border-rule rounded-md px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
              />
              <Button type="button" variant="secondary" onClick={handleAddIp}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                添加 IP
              </Button>
            </div>

            {ips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-paper/60 border border-rule/60 rounded-md">
                {ips.map((ip) => (
                  <span
                    key={ip}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper-3 border border-rule text-xs font-mono text-ink"
                  >
                    <span>{ip}</span>
                    <button
                      type="button"
                      onClick={() => removeIp(ip)}
                      className="ml-1 text-ink-muted hover:text-rose-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Condition D: Protocols & Port */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-ink-secondary block">
                4. 协议限制 (可选)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PROTOCOL_OPTIONS.map((item) => {
                  const active = protocol.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleProtocol(item.id)}
                      className={`px-2 py-1 rounded text-xs font-mono border transition-all ${
                        active
                          ? "bg-accent/20 text-accent border-accent/40 font-semibold"
                          : "bg-paper-3 text-ink-muted hover:text-ink border-rule"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-ink-secondary block">
                5. 目标端口过滤 (可选)
              </span>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="如 80,443 或 1000-2000"
                className="w-full bg-paper border border-rule rounded-md px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Condition E: Inbound Node Scope */}
          <div className="space-y-2 border-t border-rule/60 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-secondary">
                6. 规则生效节点范围
              </span>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scopeType"
                    checked={scopeType === "all"}
                    onChange={() => setScopeType("all")}
                    className="accent-accent"
                  />
                  <span>对所有入口节点生效</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scopeType"
                    checked={scopeType === "custom"}
                    onChange={() => setScopeType("custom")}
                    className="accent-accent"
                  />
                  <span>指定特定节点</span>
                </label>
              </div>
            </div>

            {scopeType === "custom" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-paper-3/50 border border-rule rounded-md">
                {nodes.map((n) => {
                  const selected = inboundNodeIds.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleNodeScope(n.id)}
                      className={`px-2 py-1.5 rounded border text-left text-xs flex items-center justify-between transition-colors ${
                        selected
                          ? "bg-accent/15 border-accent text-ink"
                          : "bg-paper border-rule text-ink-muted hover:text-ink"
                      }`}
                    >
                      <span className="truncate">{n.name}</span>
                      {selected && <Check className="w-3 h-3 text-accent flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 4. Real-time Live Syntax Preview */}
        <div className="border border-rule rounded-lg bg-paper overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-paper-3 border-b border-rule">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-ink">
                实时编译预览 (Live Config Preview)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded bg-paper border border-rule p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setPreviewTab("xray")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    previewTab === "xray" ? "bg-accent text-paper font-bold" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Xray JSON
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("clash")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    previewTab === "clash" ? "bg-accent text-paper font-bold" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Clash YAML
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("singbox")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    previewTab === "singbox" ? "bg-accent text-paper font-bold" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Sing-box
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyPreview}
                className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink px-1.5 py-0.5 rounded border border-rule hover:bg-paper-hover transition-colors"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? "已复制" : "复制"}</span>
              </button>
            </div>
          </div>

          <pre className="p-3 text-[11px] font-mono text-ink-secondary overflow-x-auto max-h-36 select-all leading-relaxed">
            {getCompiledPreview()}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-rule">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
            {saving ? "正在保存..." : rule ? "保存规则修改" : "创建分流规则"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
