import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { NodeItem, RelayLink } from "../../types";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { Input } from "../common/Input";
import { Badge } from "../common/Badge";
import {
  ShareNetwork,
  Plus,
  Trash,
  Lightning,
  ArrowsLeftRight,
  ShieldCheck,
  Sparkle,
  Cpu,
  Globe,
  ArrowRight,
} from "@phosphor-icons/react";

gsap.registerPlugin(useGSAP);

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

  const containerRef = useRef<HTMLDivElement>(null);
  const streamLinesRef = useRef<SVGSVGElement>(null);

  // Group nodes: Main connection nodes vs Dedicated unlock nodes
  const mainNodes = nodes.filter((n) => n.type === "direct" || n.type === "exit");
  const unlockNodes = nodes.filter((n) => n.type === "unlock");

  // GSAP data packet stream animation
  useGSAP(() => {
    if (!streamLinesRef.current) return;
    const flows = streamLinesRef.current.querySelectorAll(".flow-cable");
    flows.forEach((cable) => {
      gsap.to(cable, {
        strokeDashoffset: -40,
        duration: 1.5,
        repeat: -1,
        ease: "none",
      });
    });
  }, { scope: containerRef, dependencies: [relays] });

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
    <div ref={containerRef} className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-paper-2 p-5 rounded-lg border border-rule gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <ShareNetwork weight="bold" className="w-4 h-4 text-accent" />
            主力直连 + 链式解锁代理拓扑
          </h2>
          <p className="text-xs text-ink-muted mt-1 max-w-2xl leading-relaxed">
            客户端优先直连主力国外 VPS 享受千兆低延迟；当访问 OpenAI、Claude、Netflix、Disney+ 等受风控服务时，主力机 Xray 智能路由引擎自动通过链式 Outbound 转发至原生住宅/解锁 VPS 出站。
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenAddModal}
          icon={<Plus weight="bold" className="w-3.5 h-3.5" />}
        >
          创建链式解锁代理
        </Button>
      </div>

      {/* Topology Visual Stage */}
      <div className="relative bg-paper-2/90 rounded-xl border border-rule p-6 md:p-8 min-h-[480px] flex flex-col justify-between overflow-hidden shadow-sm">
        {/* Background Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(#ffffff 1px, transparent 1px), radial-gradient(#ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            backgroundPosition: "0 0, 12px 12px",
          }}
        />

        {/* Column Stage Headers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-mono uppercase tracking-wider text-ink-muted border-b border-rule pb-3 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
            <span className="font-semibold text-ink">主力直连节点 (Direct / Main VPS)</span>
            <span className="text-[11px] text-ink-muted font-normal">[{mainNodes.length} 台]</span>
          </div>
          <div className="flex items-center md:justify-end gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="font-semibold text-purple-300">流媒体 / AI 专属解锁节点 (Unlock VPS)</span>
            <span className="text-[11px] text-ink-muted font-normal">[{unlockNodes.length} 台]</span>
          </div>
        </div>

        {/* Nodes Dual Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 my-6 z-10">
          {/* Left Column: Main Direct Nodes */}
          <div className="space-y-4">
            <div className="text-[11px] font-mono text-ink-muted mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-accent" />
              <span>客户端首跳直连 • 承载大流量低延迟直连</span>
            </div>

            {mainNodes.map((mn) => {
              // Find relays associated with this main node
              const chainedRelays = relays.filter(
                (r) => r.mainNodeId === mn.id || r.transitNodeId === mn.id
              );

              return (
                <div
                  key={mn.id}
                  className="p-4 rounded-lg bg-paper border border-accent/20 hover:border-accent/50 shadow-sm transition-all relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink font-mono">
                        {mn.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-subtle text-accent border border-accent/20 font-mono">
                        {mn.countryName}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {mn.latencyMs} ms
                    </span>
                  </div>

                  <div className="text-xs font-mono text-ink-muted mt-2 flex items-center justify-between">
                    <span>IP: {mn.ip}:{mn.port}</span>
                    <span className="uppercase text-[11px] text-accent font-medium">
                      {mn.protocol}
                    </span>
                  </div>

                  {/* Chained Target Badges */}
                  {chainedRelays.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-rule flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono text-ink-muted flex items-center gap-1">
                        <ArrowsLeftRight className="w-3 h-3 text-purple-400" />
                        已挂载解锁机:
                      </span>
                      {chainedRelays.map((r) => {
                        const targetUnlock = nodes.find(
                          (n) => n.id === (r.unlockNodeId || r.exitNodeId)
                        );
                        return (
                          <span
                            key={r.id}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-500/30 flex items-center gap-1"
                          >
                            <span>{targetUnlock?.name || "解锁节点"}</span>
                            <span className="text-[9px] opacity-75">
                              ({r.mode === "all" ? "全量" : "智能分流"})
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {mainNodes.length === 0 && (
              <div className="p-8 text-center text-xs text-ink-muted border border-dashed border-rule rounded-lg">
                暂无主力直连节点，请在节点管理中添加类型为“主力直连机”的 VPS。
              </div>
            )}
          </div>

          {/* Right Column: Dedicated Unlock Nodes */}
          <div className="space-y-4">
            <div className="text-[11px] font-mono text-ink-muted mb-2 flex items-center gap-1.5 md:justify-end">
              <Sparkle className="w-3.5 h-3.5 text-purple-400" />
              <span>原生住宅 / 纯净双ISP • 专享流媒体与 AI 出站</span>
            </div>

            {unlockNodes.map((un) => {
              // Find relays targeting this unlock node
              const incomingRelays = relays.filter(
                (r) => r.unlockNodeId === un.id || r.exitNodeId === un.id
              );

              return (
                <div
                  key={un.id}
                  className="p-4 rounded-lg bg-paper border border-purple-500/30 hover:border-purple-500/60 shadow-sm transition-all relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink font-mono">
                        {un.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 border border-purple-500/20 font-mono">
                        {un.countryName}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-accent font-medium">
                      {un.latencyMs} ms
                    </span>
                  </div>

                  <div className="text-xs font-mono text-ink-muted mt-2 flex items-center justify-between">
                    <span>IP: {un.ip}:{un.port}</span>
                    <span className="uppercase text-[11px] text-purple-400 font-medium">
                      {un.protocol}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {un.tags?.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-secondary border border-rule font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Incoming Relays Indicator */}
                  {incomingRelays.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-rule text-[10px] font-mono text-ink-muted flex items-center gap-1">
                      <span className="text-emerald-400 font-medium">
                        ● 供 {incomingRelays.length} 台主力机作为解锁出站
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {unlockNodes.length === 0 && (
              <div className="p-8 text-center text-xs text-ink-muted border border-dashed border-rule rounded-lg">
                暂无专属解锁节点。可在右上角“添加节点”中添加类型为「流媒体/AI 解锁机」的 VPS（如美国家宽、英国住宅等）。
              </div>
            )}
          </div>
        </div>

        {/* Active Chained Proxy Table */}
        <div className="border-t border-rule pt-5 z-10">
          <div className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-3 flex items-center gap-2">
            <Lightning className="w-3.5 h-3.5 text-accent" />
            当前活跃链式解锁链路 ({relays.length})
          </div>

          <div className="space-y-2.5">
            {relays.map((r) => {
              const main = nodes.find(
                (n) => n.id === (r.mainNodeId || r.transitNodeId)
              );
              const unlock = nodes.find(
                (n) => n.id === (r.unlockNodeId || r.exitNodeId)
              );
              const usedGB = (r.trafficBytes / (1024 * 1024 * 1024)).toFixed(1);
              const isAiMediaMode = r.mode !== "all";

              return (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-paper border border-rule gap-3 hover:border-rule-active transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center text-accent flex-shrink-0">
                      <ArrowsLeftRight weight="bold" className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-ink flex items-center gap-2">
                        <span>{r.name}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.2 rounded-full border ${
                            isAiMediaMode
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                              : "bg-sky-950/40 text-sky-300 border-sky-500/30"
                          }`}
                        >
                          {isAiMediaMode ? "AI & 流媒体专属解锁" : "全量链式出站"}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-ink-muted flex items-center gap-2 mt-1">
                        <span className="text-accent font-medium">{main?.name || "未知主力机"}</span>
                        <span>➔</span>
                        <span className="text-purple-400 font-medium">{unlock?.name || "未知解锁机"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="text-ink-muted">链路延迟: </span>
                      <span className="text-emerald-400 font-semibold">{r.latencyMs} ms</span>
                    </div>

                    <button
                      onClick={() => onDeleteRelay(r.id)}
                      className="p-1.5 rounded text-ink-muted hover:text-status-danger hover:bg-status-danger-bg transition-colors"
                      title="删除该链式代理"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {relays.length === 0 && (
              <div className="text-center py-6 text-xs text-ink-muted">
                暂无配置的链式解锁代理。点击右上角“创建链式解锁代理”即可将主力 VPS 与专属解锁机绑定。
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
        <form onSubmit={handleCreateRelay} className="space-y-4 text-sm">
          {/* Chained Name */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
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
            <label className="block text-xs font-medium text-ink-muted mb-1">
              选择主力直连机 (客户端连接节点) *
            </label>
            <Select
              options={mainNodes.map((n) => ({
                value: n.id,
                label: `${n.name} (${n.ip})`,
                badge: n.countryName,
                desc: `延迟: ${n.latencyMs}ms • 协议: ${n.protocol.toUpperCase()}`,
              }))}
              value={mainId}
              onChange={(val) => setMainId(val)}
            />
          </div>

          {/* Unlock Node Select */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              选择专属解锁机 (流媒体/AI 目标出站) *
            </label>
            <Select
              options={unlockNodes.map((n) => ({
                value: n.id,
                label: `${n.name} (${n.ip})`,
                badge: n.countryName,
                desc: `标签: ${n.tags?.join(", ") || "原生住宅"}`,
              }))}
              value={unlockId}
              onChange={(val) => setUnlockId(val)}
            />
          </div>

          {/* Mode Select */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
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
          <div className="p-3 rounded-lg bg-paper-3/60 border border-rule text-xs text-ink-secondary space-y-1.5">
            <div className="font-medium text-accent flex items-center gap-1.5">
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

