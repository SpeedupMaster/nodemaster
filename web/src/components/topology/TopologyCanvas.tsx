import React, { useState, useRef } from "react";
import { NodeItem, RelayLink } from "../../types";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { Input } from "../common/Input";
import {
  ShareNetwork,
  Plus,
  Trash,
  Lightning,
  ArrowsLeftRight,
  ShieldCheck,
  Sparkle,
  Globe,
  ArrowRight,
  Broadcast,
  CheckCircle,
  Plugs,
  CaretRight,
  Shuffle,
  Laptop,
} from "@phosphor-icons/react";

interface TopologyCanvasProps {
  nodes: NodeItem[];
  relays: RelayLink[];
  onAddRelay: (relayData: Partial<RelayLink>) => Promise<any>;
  onDeleteRelay: (id: string) => Promise<any>;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  nodes,
  relays,
  onAddRelay,
  onDeleteRelay,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [mainId, setMainId] = useState("");
  const [unlockId, setUnlockId] = useState("");
  const [mode, setMode] = useState<"ai_media" | "all">("ai_media");
  const [submitting, setSubmitting] = useState(false);

  // Group nodes: Main connection nodes vs Dedicated unlock nodes
  const mainNodes = nodes.filter((n) => n.type === "direct" || n.type === "exit");
  const unlockNodes = nodes.filter((n) => n.type === "unlock");

  const getCountryFlag = (country?: string) => {
    if (!country) return "🌐";
    const c = country.toUpperCase();
    if (c === "HK") return "🇭🇰";
    if (c === "JP") return "🇯🇵";
    if (c === "US") return "🇺🇸";
    if (c === "UK" || c === "GB") return "🇬🇧";
    if (c === "SG") return "🇸🇬";
    if (c === "TW") return "🇹🇼";
    if (c === "KR") return "🇰🇷";
    if (c === "DE") return "🇩🇪";
    return "🌐";
  };

  const handleOpenAddModal = () => {
    if (mainNodes.length > 0) setMainId(mainNodes[0].id);
    if (unlockNodes.length > 0) setUnlockId(unlockNodes[0].id);
    setMode("ai_media");
    setName(
      mainNodes[0] && unlockNodes[0]
        ? `${mainNodes[0].name.split("-")[0]}主力 ➔ ${unlockNodes[0].name.split("-")[0]}解锁`
        : "链式解锁代理"
    );
    setIsAddModalOpen(true);
  };

  const handleCreateRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainId || !unlockId) return;

    setSubmitting(true);
    try {
      await onAddRelay({
        name: name || "链式解锁代理",
        mainNodeId: mainId,
        unlockNodeId: unlockId,
        mode,
        transitNodeId: mainId,
        exitNodeId: unlockId,
        transitPort: 443,
      });
      setIsAddModalOpen(false);
      setName("");
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar with Architecture Summary */}
      <div className="bg-paper-2 p-5 sm:p-6 rounded-2xl border border-rule shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-0.5 shadow-xs">
              <ShareNetwork weight="bold" className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-bold text-ink tracking-tight font-sans">
                  主力直连 + 链式解锁代理拓扑
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-semibold">
                  Xray 智能路由分流
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-rule">
                  {relays.length} 条活跃链路
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-1.5 max-w-2xl leading-relaxed">
                客户端直连主力海外 VPS 享受千兆低延迟；当访问 OpenAI、Claude、Netflix 等受风控服务时，主力机 Xray 智能路由引擎自动通过链式 Outbound 转发至原生住宅/双ISP 解锁 VPS 出站。
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            icon={<Plus weight="bold" className="w-3.5 h-3.5" />}
            className="shrink-0 self-start lg:self-center font-medium"
          >
            创建链式解锁代理
          </Button>
        </div>

        {/* Visual Step Pipeline: Client -> Main VPS -> Smart Routing -> Unlock VPS -> Target */}
        <div className="mt-5 pt-4 border-t border-rule/70 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-paper border border-rule/60">
            <Laptop className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="truncate">
              <span className="text-ink font-semibold">1. 客户端连接</span>
              <p className="text-[10px] text-ink-muted truncate">直连主力 VPS 享受极速</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-paper border border-rule/60">
            <Broadcast className="w-4 h-4 text-accent shrink-0" />
            <div className="truncate">
              <span className="text-ink font-semibold">2. 主力入口机</span>
              <p className="text-[10px] text-ink-muted truncate">香港 / 日本 / 新加坡 BGP</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-paper border border-rule/60">
            <Shuffle className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="truncate">
              <span className="text-ink font-semibold">3. Xray 智能分流</span>
              <p className="text-[10px] text-ink-muted truncate">OpenAI/Netflix 自动匹配</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-paper border border-rule/60">
            <Sparkle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="truncate">
              <span className="text-ink font-semibold">4. 原生家宽落地</span>
              <p className="text-[10px] text-ink-muted truncate">双ISP 住宅高信誉出口</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Topology Dual Stage */}
      <div className="relative bg-paper-2 rounded-2xl border border-rule p-5 sm:p-7 overflow-hidden shadow-xs space-y-6">
        {/* Stage Columns Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Column: 主力直连入口 (Direct / Main VPS) */}
          <div className="space-y-4">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-rule">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                  主力直连节点 (Direct / Main VPS)
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule">
                  {mainNodes.length} 台
                </span>
              </div>
              <span className="text-[10px] font-mono text-ink-muted flex items-center gap-1">
                <Globe className="w-3 h-3 text-accent" />
                <span>低延迟首跳</span>
              </span>
            </div>

            {/* Main Nodes List */}
            <div className="space-y-3">
              {mainNodes.map((mn) => {
                const chainedRelays = relays.filter(
                  (r) => r.mainNodeId === mn.id || r.transitNodeId === mn.id
                );

                return (
                  <div
                    key={mn.id}
                    className="p-4 rounded-xl bg-paper border border-rule hover:border-accent/50 shadow-xs transition-all space-y-3 group"
                  >
                    {/* Node Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{getCountryFlag(mn.country)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink font-mono group-hover:text-accent transition-colors">
                              {mn.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-secondary border border-rule font-sans">
                              {mn.countryName}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-ink-muted mt-0.5 block">
                            {mn.ip}:{mn.port}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-semibold">
                          {mn.protocol}
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {mn.latencyMs} ms
                        </span>
                      </div>
                    </div>

                    {/* Chained Target Badges / Routing status */}
                    <div className="pt-2.5 border-t border-rule/60 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
                      {chainedRelays.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-ink-muted flex items-center gap-1 text-[10px]">
                            <ArrowsLeftRight className="w-3 h-3 text-purple-400" />
                            <span>已挂载解锁出站:</span>
                          </span>
                          {chainedRelays.map((r) => {
                            const targetUnlock = nodes.find(
                              (n) => n.id === (r.unlockNodeId || r.exitNodeId)
                            );
                            return (
                              <span
                                key={r.id}
                                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-medium"
                              >
                                <span>{getCountryFlag(targetUnlock?.country)}</span>
                                <span>{targetUnlock?.name || "解锁节点"}</span>
                                <span className="text-[9px] text-purple-400/80">
                                  ({r.mode === "all" ? "全量" : "智能分流"})
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-ink-muted flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rule-active" />
                          <span>未挂载解锁机 · 全部流量直连出站</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {mainNodes.length === 0 && (
                <div className="p-8 text-center text-xs font-mono text-ink-muted border border-dashed border-rule rounded-xl bg-paper/50">
                  暂无主力直连节点，请在节点管理中添加类型为「主力直连机」的 VPS。
                </div>
              )}
            </div>
          </div>

          {/* Right Column: 专属解锁落地 (Unlock / Exit VPS) */}
          <div className="space-y-4">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-rule">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider font-mono">
                  流媒体 / AI 专属解锁节点 (Unlock VPS)
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule">
                  {unlockNodes.length} 台
                </span>
              </div>
              <span className="text-[10px] font-mono text-purple-400 flex items-center gap-1">
                <Sparkle className="w-3 h-3 text-purple-400" />
                <span>原生纯净双ISP</span>
              </span>
            </div>

            {/* Unlock Nodes List */}
            <div className="space-y-3">
              {unlockNodes.map((un) => {
                const incomingRelays = relays.filter(
                  (r) => r.unlockNodeId === un.id || r.exitNodeId === un.id
                );

                return (
                  <div
                    key={un.id}
                    className="p-4 rounded-xl bg-paper border border-purple-500/25 hover:border-purple-500/60 shadow-xs transition-all space-y-3 group"
                  >
                    {/* Node Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{getCountryFlag(un.country)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink font-mono group-hover:text-purple-300 transition-colors">
                              {un.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-sans">
                              {un.countryName}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-ink-muted mt-0.5 block">
                            {un.ip}:{un.port}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold">
                          {un.protocol === "shadowsocks" ? "Shadowsocks (SS)" : un.protocol}
                        </span>
                        <span className="text-xs font-mono text-ink-secondary font-bold">
                          {un.latencyMs} ms
                        </span>
                      </div>
                    </div>

                    {/* Characteristic Tags Row */}
                    <div className="flex flex-wrap gap-1.5">
                      {un.tags && un.tags.length > 0 ? (
                        un.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-paper-3 text-ink-secondary border border-rule font-mono"
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-paper-3 text-ink-muted border border-rule font-mono">
                          原生家宽住宅
                        </span>
                      )}
                    </div>

                    {/* Incoming Relays Indicator */}
                    <div className="pt-2.5 border-t border-rule/60 flex items-center justify-between text-[11px] font-mono">
                      {incomingRelays.length > 0 ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>已为 {incomingRelays.length} 台主力机提供解锁出站</span>
                        </span>
                      ) : (
                        <span className="text-ink-muted text-[10px]">
                          空闲中 · 尚未指派给任何主力直连机
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {unlockNodes.length === 0 && (
                <div className="p-8 text-center text-xs font-mono text-ink-muted border border-dashed border-rule rounded-xl bg-paper/50">
                  暂无专属解锁节点。可在右上角“添加节点”中添加类型为「流媒体/AI 解锁机」的 VPS。
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Active Chained Proxy Pipeline List */}
        <div className="border-t border-rule pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono uppercase tracking-wider text-ink-muted flex items-center gap-2">
              <Lightning weight="fill" className="w-3.5 h-3.5 text-accent" />
              <span className="font-semibold text-ink">当前活跃链式解锁链路</span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-paper-3 text-ink-muted border border-rule">
                {relays.length} 条已生效
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {relays.map((r) => {
              const main = nodes.find(
                (n) => n.id === (r.mainNodeId || r.transitNodeId)
              );
              const unlock = nodes.find(
                (n) => n.id === (r.unlockNodeId || r.exitNodeId)
              );
              const isAiMediaMode = r.mode !== "all";

              return (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-paper border border-rule hover:border-rule-active transition-all shadow-xs gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                      <ArrowsLeftRight weight="bold" className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-bold text-ink font-sans">
                          {r.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium ${
                            isAiMediaMode
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                          }`}
                        >
                          {isAiMediaMode ? "AI & 流媒体专属解锁" : "全量链式出站"}
                        </span>
                      </div>

                      {/* Path Visualization with Node Badges */}
                      <div className="flex items-center gap-2 mt-2 text-xs font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-paper-3 text-accent border border-accent/20 flex items-center gap-1 font-semibold">
                          <span>{getCountryFlag(main?.country)}</span>
                          <span>{main?.name || "主力机"}</span>
                        </span>
                        <span className="text-ink-muted text-xs">➔</span>
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/25 flex items-center gap-1 font-semibold">
                          <span>{getCountryFlag(unlock?.country)}</span>
                          <span>{unlock?.name || "解锁机"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-xs font-mono justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-rule/50">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-ink-muted block">综合链路时延</span>
                      <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {r.latencyMs} ms
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (window.confirm(`确定删除链路「${r.name}」吗？`)) {
                          onDeleteRelay(r.id);
                        }
                      }}
                      className="p-2 rounded-lg text-ink-muted hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                      title="删除该链式代理"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {relays.length === 0 && (
              <div className="text-center py-8 text-xs font-mono text-ink-muted border border-dashed border-rule rounded-xl bg-paper/30">
                暂无配置的链式解锁代理。点击上方“创建链式解锁代理”即可将主力 VPS 与专属解锁机绑定。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Chained Relay Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="创建链式解锁代理"
        subtitle="将主力直连 VPS 与原生住宅/解锁 VPS 建立 Xray 链式出站与智能分流"
        maxWidth="md"
      >
        <form onSubmit={handleCreateRelay} className="space-y-4 text-sm font-sans">
          {/* Chained Name */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              链路名称 *
            </label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 香港主力 ➔ 美国家宽 AI 解锁"
            />
          </div>

          {/* Main Node Select */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              选择主力直连机 (客户端连接节点) *
            </label>
            <Select
              options={mainNodes.map((n) => ({
                value: n.id,
                label: `${getCountryFlag(n.country)} ${n.name} (${n.ip})`,
                badge: n.countryName,
                desc: `延迟: ${n.latencyMs}ms • 协议: ${n.protocol.toUpperCase()}`,
              }))}
              value={mainId}
              onChange={(val) => setMainId(val)}
            />
          </div>

          {/* Unlock Node Select */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              选择专属解锁机 (流媒体/AI 目标出站) *
            </label>
            <Select
              options={unlockNodes.map((n) => ({
                value: n.id,
                label: `${getCountryFlag(n.country)} ${n.name} (${n.ip})`,
                badge: n.countryName,
                desc: `标签: ${n.tags?.join(", ") || "原生住宅"}`,
              }))}
              value={unlockId}
              onChange={(val) => setUnlockId(val)}
            />
          </div>

          {/* Mode Select */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              解锁分流模式 *
            </label>
            <Select
              options={[
                {
                  value: "ai_media",
                  label: "智能分流模式 (AI & 流媒体专属解锁) - 推荐",
                  desc: "仅 OpenAI, Claude, Netflix, Disney+, YouTube Premium 等走解锁机，常规流量直连，省流低延迟",
                  badge: "推荐",
                },
                {
                  value: "all",
                  label: "全量链式出站 (所有流量经解锁机出口)",
                  desc: "主力机仅作为前跳中继，所有流量统一经解锁机发出，完全隐藏主力 IP",
                  badge: "全量",
                },
              ]}
              value={mode}
              onChange={(val) => setMode(val as "ai_media" | "all")}
            />
          </div>

          {/* Architecture Explanatory Banner */}
          <div className="p-3.5 rounded-xl bg-paper-3/60 border border-rule text-xs text-ink-secondary space-y-1.5">
            <div className="font-semibold text-accent flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>工作原理说明</span>
            </div>
            <p className="leading-relaxed text-[11px] text-ink-muted">
              保存后，主控将为该主力节点动态注入 <code>UNLOCK_OUT</code> 出站及对应 <code>geosite:openai</code>、<code>geosite:netflix</code> 路由分流规则。客户端只需导入主力节点订阅，即可享受原生流媒体与 AI 的极速解锁，无需客户端任何额外规则配置。
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-rule flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={!mainId || !unlockId}
            >
              保存并下发链式规则
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
