import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "../common/Modal";
import { Input } from "../common/Input";
import { Select, SelectOption } from "../common/Select";
import { Button } from "../common/Button";
import { DatePicker } from "../common/DatePicker";
import { NodeItem, NodeInput } from "../../types";
import { GB } from "../../utils/format";
import { Globe, Key, Sparkle, ArrowsClockwise, CalendarBlank } from "@phosphor-icons/react";

type NodeKind = "direct" | "unlock";

interface NodeFormProps {
  /** The node to edit; omit to add a new one. */
  node?: NodeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: NodeInput) => Promise<unknown>;
}

const COUNTRY_OPTIONS: SelectOption[] = [
  { value: "HK", label: "中国香港 (HK)", badge: "香港" },
  { value: "JP", label: "日本东京 (JP)", badge: "东京" },
  { value: "US", label: "美国洛杉矶 (US)", badge: "洛杉矶" },
  { value: "SG", label: "新加坡 (SG)", badge: "狮城" },
  { value: "TW", label: "中国台湾 (TW)", badge: "台北" },
  { value: "KR", label: "韩国首尔 (KR)", badge: "首尔" },
  { value: "DE", label: "德国法兰克福 (DE)", badge: "法兰克福" },
  { value: "GB", label: "英国伦敦 (GB)", badge: "伦敦" },
];
const countryName = (code: string) => COUNTRY_OPTIONS.find((c) => c.value === code)?.label.split(" ")[0] ?? code;

// Must stay within the server's SS_CIPHERS
const SS_METHOD_OPTIONS: SelectOption[] = [
  { value: "2022-blake3-aes-128-gcm", label: "2022-blake3-aes-128-gcm", badge: "SS-2022 首选", desc: "16 字节 Base64 密钥，CPU 占用低，抗重放" },
  { value: "2022-blake3-aes-256-gcm", label: "2022-blake3-aes-256-gcm", badge: "强安全", desc: "32 字节 Base64 密钥" },
  { value: "2022-blake3-chacha20-poly1305", label: "2022-blake3-chacha20-poly1305", badge: "ARM 优化", desc: "32 字节 Base64 密钥，适合无 AES 指令的 CPU" },
  { value: "aes-128-gcm", label: "aes-128-gcm", badge: "经典兼容", desc: "传统 AEAD 加密，客户端兼容性最好" },
  { value: "aes-256-gcm", label: "aes-256-gcm", badge: "经典兼容", desc: "传统 AEAD 加密" },
  { value: "chacha20-ietf-poly1305", label: "chacha20-ietf-poly1305", badge: "经典兼容", desc: "传统 AEAD 加密，适合 ARM" },
];
const DEFAULT_SS_METHOD = "2022-blake3-aes-128-gcm";
const DEFAULT_SNI = "www.microsoft.com";
const SNI_PRESETS = ["www.microsoft.com", "www.apple.com", "addons.mozilla.org", "gateway.icloud.com", "itunes.apple.com"];

/** Random Base64 key of the length the cipher expects (16 bytes for aes-128 SS-2022, otherwise 32). */
function generateSsKey(method: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(method === "2022-blake3-aes-128-gcm" ? 16 : 32));
  return btoa(String.fromCharCode(...bytes));
}

interface FormState {
  kind: NodeKind;
  name: string;
  ip: string;
  port: string;
  country: string;
  bandwidthMbps: string;
  trafficLimitGB: string;
  trafficResetDay: string;
  costAmount: string;
  costCurrency: NonNullable<NodeItem["costCurrency"]>;
  costPeriod: NonNullable<NodeItem["costPeriod"]>;
  expiresAt: string;
  autoRenew: boolean;
  sni: string;
  ssMethod: string;
  ssPassword: string;
  tags: string;
}

const KIND_DEFAULTS: Record<NodeKind, Pick<FormState, "port" | "country" | "tags">> = {
  direct: { port: "443", country: "HK", tags: "主力直连, 原生IP, 千兆带宽" },
  unlock: { port: "8388", country: "US", tags: "原生住宅, Shadowsocks, 流媒体解锁, OpenAI" },
};

function initialState(node?: NodeItem | null): FormState {
  if (!node) {
    return {
      kind: "direct",
      name: "",
      ip: "",
      ...KIND_DEFAULTS.direct,
      bandwidthMbps: "1000",
      trafficLimitGB: "1000",
      trafficResetDay: "1",
      costAmount: "",
      costCurrency: "CNY",
      costPeriod: "monthly",
      expiresAt: "",
      autoRenew: false,
      sni: DEFAULT_SNI,
      ssMethod: DEFAULT_SS_METHOD,
      ssPassword: generateSsKey(DEFAULT_SS_METHOD),
      tags: KIND_DEFAULTS.direct.tags,
    };
  }
  const kind: NodeKind = node.protocol === "shadowsocks" ? "unlock" : "direct";
  return {
    kind,
    name: node.name,
    ip: node.ip,
    port: String(node.port),
    country: node.country || "HK",
    bandwidthMbps: String(node.bandwidthMbps || 1000),
    trafficLimitGB: String(Math.round(node.trafficLimitBytes / GB)),
    trafficResetDay: String(node.trafficResetDay || 1),
    costAmount: node.costAmount != null ? String(node.costAmount) : "",
    costCurrency: node.costCurrency || "CNY",
    costPeriod: node.costPeriod || "monthly",
    expiresAt: node.expiresAt || "",
    autoRenew: Boolean(node.autoRenew),
    sni: node.reality?.serverName || DEFAULT_SNI,
    ssMethod: node.shadowsocks?.method || DEFAULT_SS_METHOD,
    ssPassword: node.shadowsocks?.password || "",
    tags: node.tags?.join(", ") || "",
  };
}

function toInput(form: FormState, isNew: boolean): NodeInput {
  const unlock = form.kind === "unlock";
  return {
    name: form.name.trim(),
    ip: form.ip.trim(),
    port: Number(form.port) || Number(KIND_DEFAULTS[form.kind].port),
    // The protocol is fixed once a node exists
    ...(isNew ? { protocol: unlock ? "shadowsocks" : "vless-reality" } : {}),
    country: form.country,
    countryName: countryName(form.country),
    bandwidthMbps: Number(form.bandwidthMbps) || 1000,
    trafficLimitBytes: Number(form.trafficLimitGB) * GB,
    trafficResetDay: Number(form.trafficResetDay) || 1,
    costAmount: form.costAmount.trim() !== "" ? Number(form.costAmount) : null,
    costCurrency: form.costCurrency,
    costPeriod: form.costPeriod,
    expiresAt: form.expiresAt.trim() || null,
    autoRenew: form.autoRenew,
    tags: form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    ...(unlock ? { shadowsocks: { method: form.ssMethod, password: form.ssPassword } } : { sni: form.sni.trim() }),
  };
}

/** Field label with optional one-click preset chips on the right. */
const Field: React.FC<{
  label: React.ReactNode;
  presets?: { label: string; value: string }[];
  active?: string;
  onPreset?: (value: string) => void;
  children: React.ReactNode;
}> = ({ label, presets, active, onPreset, children }) => (
  <div>
    <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
      <label className="text-xs font-medium text-ink-muted shrink-0 whitespace-nowrap flex items-center gap-1">{label}</label>
      {presets && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 shrink min-w-0">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPreset?.(p.value)}
              className={`text-[10px] px-2 py-0.5 sm:px-1.5 rounded font-mono shrink-0 whitespace-nowrap cursor-pointer transition-all border select-none touch-manipulation ${
                active === p.value
                  ? "bg-accent/15 text-accent border-accent/40 font-semibold"
                  : "bg-paper-3 text-ink-secondary hover:text-ink hover:bg-paper-hover border-rule"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
    {children}
  </div>
);

const KIND_CARDS: { kind: NodeKind; title: string; badge: string; desc: string; protocol: string; icon: React.ReactNode }[] = [
  {
    kind: "direct",
    title: "主力直连机",
    badge: "高速直连",
    desc: "客户端第一跳直连出口，部署 VLESS-Reality 免证书协议",
    protocol: "VLESS-Reality",
    icon: <Globe weight="bold" className="w-4 h-4" />,
  },
  {
    kind: "unlock",
    title: "流媒体/AI 解锁机",
    badge: "SS 解锁",
    desc: "原生住宅 VPS，部署轻量 Shadowsocks 协议，专供链式解锁",
    protocol: "Shadowsocks",
    icon: <Sparkle weight="bold" className="w-4 h-4" />,
  },
];

export const NodeForm: React.FC<NodeFormProps> = ({ node, isOpen, onClose, onSubmit }) => {
  const isNew = !node;
  const [form, setForm] = useState<FormState>(() => initialState(node));
  const [initialJson, setInitialJson] = useState(() => JSON.stringify(form));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reload the form each time it opens
  useEffect(() => {
    if (!isOpen) return;
    const next = initialState(node);
    setForm(next);
    setInitialJson(JSON.stringify(next));
    setSubmitError(null);
  }, [node, isOpen]);

  const isDirty = useMemo(() => JSON.stringify(form) !== initialJson, [form, initialJson]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setKind = (kind: NodeKind) => setForm((f) => ({ ...f, kind, ...KIND_DEFAULTS[kind] }));
  const isUnlock = form.kind === "unlock";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ip.trim()) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(toInput(form, isNew));
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "保存失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const currencySymbol = form.costCurrency === "USD" ? "$" : form.costCurrency === "EUR" ? "€" : "¥";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isNew ? "添加新的 VPS 节点" : "编辑 VPS 节点配置"}
      subtitle={
        isNew
          ? isUnlock
            ? "纳管原生解锁机，自动生成 Shadowsocks 服务端配置"
            : "纳管主力直连机，自动生成 Xray-core Reality 配置"
          : `修改节点 ${node.name} 的网络连接属性与规格配额`
      }
      maxWidth="xl"
      isDirty={isDirty}
      discardTitle="放弃未保存的修改？"
      discardMessage="表单内容尚未保存，现在退出将丢失所有输入。"
      footer={({ requestClose }) => (
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={requestClose}
            className="flex-1 sm:flex-initial min-h-[44px] px-5 touch-manipulation text-ink-muted hover:text-ink"
          >
            取消
          </Button>
          <Button
            type="submit"
            form="node-form"
            variant="primary"
            loading={submitting}
            className="flex-1 sm:flex-initial min-h-[44px] px-6 touch-manipulation font-semibold shadow-sm"
          >
            {isNew ? "立即生成并上线" : "保存修改"}
          </Button>
        </div>
      )}
    >
      <form id="node-form" onSubmit={handleSubmit} className="space-y-4 text-sm">
        {submitError && (
          <p role="alert" className="text-sm text-red-400">
            {submitError}
          </p>
        )}

        {isNew ? (
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">节点拓扑类型 *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KIND_CARDS.map((c) => {
                const active = form.kind === c.kind;
                const tone = c.kind === "unlock" ? "purple" : "accent";
                return (
                  <button
                    key={c.kind}
                    type="button"
                    onClick={() => setKind(c.kind)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between text-left select-none ${
                      active
                        ? tone === "purple"
                          ? "bg-purple-950/20 border-purple-500 ring-1 ring-purple-500/40 shadow-sm"
                          : "bg-accent/10 border-accent ring-1 ring-accent/40 shadow-sm"
                        : "bg-paper border-rule hover:border-rule-active hover:bg-paper-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className={`flex items-center gap-2 text-xs font-semibold ${active ? "text-ink" : "text-ink-secondary"}`}>
                        <span className={active ? (tone === "purple" ? "text-purple-400" : "text-accent") : "text-ink-muted"}>{c.icon}</span>
                        {c.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-mono whitespace-nowrap shrink-0">
                        {c.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted mt-2 leading-relaxed">{c.desc}</p>
                    <div className="mt-3 pt-2 border-t border-rule/50 flex items-center justify-between text-[10px] font-mono w-full">
                      <span className={tone === "purple" ? "text-purple-400" : "text-accent"}>协议: {c.protocol}</span>
                      <span className="text-ink-muted">端口: {KIND_DEFAULTS[c.kind].port}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-paper-3/50 border border-rule text-xs font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-ink-muted shrink-0">节点 ID:</span>
              <span className="text-ink font-medium truncate">{node.id}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded font-medium text-[10px] border ${
                isUnlock ? "bg-purple-500/10 text-purple-300 border-purple-500/30" : "bg-accent/10 text-accent border-accent/30"
              }`}
            >
              {isUnlock ? "流媒体解锁机 (Shadowsocks)" : "主力直连机 (VLESS-Reality)"}
            </span>
          </div>
        )}

        <Field label="节点标识名称 *">
          <Input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={isUnlock ? "例如: US-Residential-Unlock-02" : "例如: HK-BGP-Direct-02"}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Field label="公网 IP 地址 *">
              <Input required value={form.ip} onChange={(e) => set("ip", e.target.value)} placeholder="例如: 154.23.189.90" />
            </Field>
          </div>
          <Field label="服务端口">
            <Input type="number" value={form.port} onChange={(e) => set("port", e.target.value)} suffixText="端口" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <Field
            label="地理位置"
            presets={["HK", "JP", "US", "SG"].map((c) => ({ label: c, value: c }))}
            active={form.country}
            onPreset={(v) => set("country", v)}
          >
            <Select options={COUNTRY_OPTIONS} value={form.country} onChange={(v) => set("country", v)} />
          </Field>
          <Field
            label="标称峰值带宽"
            presets={[
              { label: "500M", value: "500" },
              { label: "1Gbps", value: "1000" },
              { label: "2.5G", value: "2500" },
              { label: "10G", value: "10000" },
            ]}
            active={form.bandwidthMbps}
            onPreset={(v) => set("bandwidthMbps", v)}
          >
            <Input type="number" value={form.bandwidthMbps} onChange={(e) => set("bandwidthMbps", e.target.value)} suffixText="Mbps" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <Field
            label="月度流量配额"
            presets={[
              { label: "500G", value: "500" },
              { label: "1T", value: "1000" },
              { label: "2T", value: "2000" },
              { label: "5T", value: "5000" },
            ]}
            active={form.trafficLimitGB}
            onPreset={(v) => set("trafficLimitGB", v)}
          >
            <Input type="number" value={form.trafficLimitGB} onChange={(e) => set("trafficLimitGB", e.target.value)} suffixText="GB" />
          </Field>
          <Field
            label="流量重置日"
            presets={[
              { label: "1日", value: "1" },
              { label: "15日", value: "15" },
              { label: "28日", value: "28" },
            ]}
            active={form.trafficResetDay}
            onPreset={(v) => set("trafficResetDay", v)}
          >
            <Input
              type="number"
              min={1}
              max={31}
              value={form.trafficResetDay}
              onChange={(e) => set("trafficResetDay", e.target.value)}
              suffixText="日"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <Field
            label="VPS 费用金额"
            presets={[
              { label: "¥ 人民币", value: "CNY" },
              { label: "$ 美元", value: "USD" },
              { label: "€ 欧元", value: "EUR" },
            ]}
            active={form.costCurrency}
            onPreset={(v) => set("costCurrency", v as FormState["costCurrency"])}
          >
            <Input
              type="number"
              step="any"
              min="0"
              value={form.costAmount}
              onChange={(e) => set("costAmount", e.target.value)}
              placeholder="0.00"
              prefixText={currencySymbol}
              suffixText={form.costCurrency}
            />
          </Field>
          <Field label="付款周期">
            <Select
              options={[
                { label: "月付 (按月续费)", value: "monthly" },
                { label: "季付 (按季度续费)", value: "quarterly" },
                { label: "年付 (按年续费)", value: "annually" },
              ]}
              value={form.costPeriod}
              onChange={(v) => set("costPeriod", v as FormState["costPeriod"])}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <Field
            label={
              <>
                <CalendarBlank className="w-3.5 h-3.5 text-accent" />
                VPS 到期日期
              </>
            }
          >
            <DatePicker value={form.expiresAt} onChange={(v) => set("expiresAt", v)} placeholder="请选择到期日期 (年-月-日)" />
          </Field>
          <Field
            label={
              <>
                <ArrowsClockwise className="w-3.5 h-3.5 text-accent" />
                自动续费
              </>
            }
          >
            <button
              type="button"
              onClick={() => set("autoRenew", !form.autoRenew)}
              className={`w-full h-[34px] px-3 rounded-md border flex items-center justify-between transition-all cursor-pointer select-none touch-manipulation ${
                form.autoRenew
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15"
                  : "bg-paper border-rule text-ink-muted hover:border-rule-active hover:text-ink-secondary"
              }`}
            >
              <span className="text-xs font-mono font-medium truncate pr-2">
                {form.autoRenew ? "到期自动续费" : "手动续费"}
              </span>
              <span
                className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                  form.autoRenew ? "bg-emerald-500" : "bg-paper-3 border border-rule"
                }`}
              >
                <span
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-200 ${
                    form.autoRenew ? "translate-x-3.5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </Field>
        </div>

        {isUnlock ? (
          <div className="space-y-3 p-3.5 rounded-lg bg-paper-3/40 border border-purple-500/20">
            <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-400" />
              Shadowsocks 参数
            </span>
            <Field label="加密算法 (Cipher Method) *">
              <Select
                options={SS_METHOD_OPTIONS}
                value={form.ssMethod}
                onChange={(v) => setForm((f) => ({ ...f, ssMethod: v, ssPassword: generateSsKey(v) }))}
              />
            </Field>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-ink-muted">连接密码 / Base64 密钥 *</label>
                <button
                  type="button"
                  onClick={() => set("ssPassword", generateSsKey(form.ssMethod))}
                  className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-mono"
                >
                  <ArrowsClockwise className="w-3 h-3" />
                  重新生成密钥
                </button>
              </div>
              <Input
                required
                value={form.ssPassword}
                onChange={(e) => set("ssPassword", e.target.value)}
                placeholder="Shadowsocks 密码或 Base64 密钥"
              />
            </div>
          </div>
        ) : (
          <Field
            label="SNI 伪装域名 *"
            presets={SNI_PRESETS.map((d) => ({ label: d.replace(/^www\./, "").split(".")[0], value: d }))}
            active={form.sni}
            onPreset={(v) => set("sni", v)}
          >
            <Input required value={form.sni} onChange={(e) => set("sni", e.target.value)} placeholder={DEFAULT_SNI} suffixText="SNI" />
          </Field>
        )}

        <Field label="标签 (以逗号分隔)">
          <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="原生IP, 流媒体解锁, OpenAI" />
        </Field>

        {!isNew && (
          <p className="text-[11px] text-ink-muted leading-relaxed">
            修改端口、SNI 或密钥并保存后，探针会在下次上报时拉取新配置并重载 Xray，无需登录 SSH。
          </p>
        )}
      </form>
    </Modal>
  );
};
