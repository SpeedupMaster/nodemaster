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
  Warning,
  MagnifyingGlass,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingRelay, setDeletingRelay] = useState<RelayLink | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search & Filter state for Direct Fleet
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUnlockFilter, setActiveUnlockFilter] = useState("all");

  // Defensive deduplication for relays list by ID
  const uniqueRelays = Array.from(new Map(relays.map((r) => [r.id, r])).values());

  // Group nodes: Main connection nodes vs Dedicated unlock nodes
  const mainNodes = nodes.filter((n) => n.type === "direct" || n.type === "exit");
  const unlockNodes = nodes.filter((n) => n.type === "unlock");

  // High-contrast, clean regional indicator badge that renders crisply across all OSes
  const renderCountryBadge = (country?: string, size: "sm" | "md" = "md") => {
    const code = (country || "UN").toUpperCase();
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      HK: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
      JP: { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30" },
      US: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
      UK: { bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/30" },
      GB: { bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/30" },
      SG: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
      TW: { bg: "bg-sky-500/15", text: "text-sky-400", border: "border-sky-500/30" },
      DE: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
    };
    const theme = colors[code] || { bg: "bg-accent/15", text: "text-accent", border: "border-accent/30" };
    const displayCode = code === "GB" ? "UK" : code;

    if (size === "sm") {
      return (
        <span
          className={`px-1.5 py-0.2 rounded ${theme.bg} ${theme.text} border ${theme.border} font-mono text-[10px] font-bold shrink-0 select-none`}
        >
          {displayCode}
        </span>
      );
    }

    return (
      <span
        className={`w-7 h-7 rounded-lg ${theme.bg} ${theme.text} border ${theme.border} flex items-center justify-center font-mono text-[11px] font-bold shrink-0 shadow-xs select-none`}
      >
        {displayCode}
      </span>
    );
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
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  const handleCreateRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainId || !unlockId || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await onAddRelay({
        name: name || "链式解锁代理",
        mainNodeId: mainId,
        unlockNodeId: unlockId,
        mode,
        transitNodeId: mainId,
        exitNodeId: unlockId,
        transitPort: 443,
      });
      if (res && res.success === false) {
        setErrorMessage(res.message || "创建失败，请检查是否已存在相同链路");
        return;
      }
      setIsAddModalOpen(false);
      setName("");
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "网络异常或服务不可用");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAttach = (directNodeId: string) => {
    setMainId(directNodeId);
    if (unlockNodes.length > 0) setUnlockId(unlockNodes[0].id);
    const mn = mainNodes.find((n) => n.id === directNodeId);
    const un = unlockNodes[0];
    setName(
      mn && un
        ? `${mn.name.split("-")[0]}主力 ➔ ${un.name.split("-")[0]}解锁`
        : "链式解锁代理"
    );
    setMode("ai_media");
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  // Filtered direct nodes by search query and active unlock gateway filter
  const filteredMainNodes = mainNodes.filter((mn) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      mn.name.toLowerCase().includes(q) ||
      mn.ip.includes(q) ||
      (mn.countryName && mn.countryName.toLowerCase().includes(q)) ||
      (mn.country && mn.country.toLowerCase().includes(q));

    if (!matchQuery) return false;

    const chained = uniqueRelays.filter(
      (r) => r.mainNodeId === mn.id || r.transitNodeId === mn.id
    );

    if (activeUnlockFilter === "all") return true;
    if (activeUnlockFilter === "bound") return chained.length > 0;
    if (activeUnlockFilter === "unbound") return chained.length === 0;
    return chained.some(
      (r) => r.unlockNodeId === activeUnlockFilter || r.exitNodeId === activeUnlockFilter
    );
  });

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
                  {uniqueRelays.length} 条活跃链路
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

      {/* 2. Top Tier: Dedicated Unlock Exit Gateways Deck */}
      <div className="bg-paper-2 rounded-2xl border border-purple-500/25 p-5 sm:p-6 shadow-xs space-y-4">
        {/* Gateway Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-rule">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
            <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider font-mono">
              流媒体 / AI 专属落地网关池 (Unlock Gateways)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
              {unlockNodes.length} 台落地网关
            </span>
          </div>
          <span className="text-[11px] font-mono text-purple-400/90 flex items-center gap-1.5">
            <Sparkle className="w-3.5 h-3.5 text-purple-400" />
            <span>原生纯净双ISP · 共享高信誉出口</span>
          </span>
        </div>

        {/* Gateway Cards Grid (1~3 per row) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {unlockNodes.map((un) => {
            const incomingRelays = uniqueRelays.filter(
              (r) => r.unlockNodeId === un.id || r.exitNodeId === un.id
            );
            const isCurrentFilter = activeUnlockFilter === un.id;

            return (
              <div
                key={un.id}
                className={`p-4 rounded-xl bg-paper border transition-all flex flex-col justify-between group space-y-3 shadow-xs ${
                  isCurrentFilter
                    ? "border-purple-400 ring-2 ring-purple-500/20 bg-paper-3"
                    : "border-purple-500/25 hover:border-purple-500/60"
                }`}
              >
                {/* Gateway Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {renderCountryBadge(un.country)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink font-mono group-hover:text-purple-300 transition-colors truncate max-w-[140px]">
                          {un.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-sans shrink-0">
                          {un.countryName}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-ink-muted mt-0.5 block truncate">
                        {un.ip}:{un.port}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold">
                      {un.protocol === "shadowsocks" ? "Shadowsocks (SS)" : un.protocol}
                    </span>
                    <span className="text-xs font-mono text-ink-secondary font-bold">
                      {un.latencyMs} ms
                    </span>
                  </div>
                </div>

                {/* Characteristic Tags */}
                <div className="flex items-center gap-1.5 flex-wrap overflow-hidden h-6">
                  {un.tags && un.tags.length > 0 ? (
                    un.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-mono"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule font-mono">
                      原生家宽住宅
                    </span>
                  )}
                </div>

                {/* Gateway Service Status Bar & Filter Action */}
                <div className="pt-2.5 border-t border-rule/60 flex items-center justify-between text-[11px] font-mono">
                  {incomingRelays.length > 0 ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400 font-medium text-[10px] truncate">
                        已为 {incomingRelays.length} 台主力机提供解锁
                      </span>
                    </div>
                  ) : (
                    <span className="text-ink-muted text-[10px] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rule-active" />
                      <span>待命中 · 尚未指派主力机</span>
                    </span>
                  )}

                  <button
                    onClick={() =>
                      setActiveUnlockFilter((prev) => (prev === un.id ? "all" : un.id))
                    }
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer shrink-0 font-mono ${
                      isCurrentFilter
                        ? "bg-purple-500/25 text-purple-200 border-purple-500/50 font-bold"
                        : "bg-paper-3 text-ink-muted hover:text-ink hover:border-rule-active border-rule"
                    }`}
                  >
                    {isCurrentFilter ? "取消高亮" : "查看关联主力机"}
                  </button>
                </div>
              </div>
            );
          })}

          {unlockNodes.length === 0 && (
            <div className="p-8 text-center text-xs font-mono text-ink-muted border border-dashed border-rule rounded-xl bg-paper/50 col-span-full">
              暂无专属解锁落地机。可在右上角“添加节点”中添加类型为「流媒体/AI 解锁机」的 VPS。
            </div>
          )}
        </div>
      </div>

      {/* Visual Pipeline Flow Connector */}
      <div className="flex items-center justify-center -my-2 relative z-10">
        <div className="px-4 py-1.5 rounded-full bg-paper-2 border border-rule shadow-sm flex items-center gap-2 text-[11px] font-mono text-ink-muted">
          <ArrowsLeftRight weight="bold" className="w-3.5 h-3.5 text-accent animate-pulse" />
          <span>Xray 智能路由分流层 · 规则流量出站至上方落地网关 · 常规流量全直连</span>
        </div>
      </div>

      {/* 3. Direct Inbound Fleet (Multi-column Responsive Grid) */}
      <div className="bg-paper-2 rounded-2xl border border-rule p-5 sm:p-7 shadow-xs space-y-5">
        {/* Section Header with Search & Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-rule">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              主力直连节点集群 (Direct Inbound Fleet)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-rule">
              共 {mainNodes.length} 台{filteredMainNodes.length !== mainNodes.length ? ` · 筛选显示 ${filteredMainNodes.length} 台` : ""}
            </span>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative w-44 sm:w-56">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索名称 / IP / 地区..."
                className="text-xs pl-8 py-1 h-8"
              />
              <MagnifyingGlass className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-paper p-1 rounded-lg border border-rule text-[11px] font-mono">
              <button
                onClick={() => setActiveUnlockFilter("all")}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  activeUnlockFilter === "all"
                    ? "bg-accent text-paper font-semibold shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                全部 ({mainNodes.length})
              </button>
              <button
                onClick={() => setActiveUnlockFilter("bound")}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  activeUnlockFilter === "bound"
                    ? "bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                已挂载解锁 ({mainNodes.filter((mn) => uniqueRelays.some((r) => r.mainNodeId === mn.id || r.transitNodeId === mn.id)).length})
              </button>
              <button
                onClick={() => setActiveUnlockFilter("unbound")}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  activeUnlockFilter === "unbound"
                    ? "bg-paper-3 text-ink font-semibold border border-rule"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                纯直连 ({mainNodes.filter((mn) => !uniqueRelays.some((r) => r.mainNodeId === mn.id || r.transitNodeId === mn.id)).length})
              </button>
            </div>
          </div>
        </div>

        {/* Direct Nodes Multi-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMainNodes.map((mn) => {
            const chainedRelays = uniqueRelays.filter(
              (r) => r.mainNodeId === mn.id || r.transitNodeId === mn.id
            );

            return (
              <div
                key={mn.id}
                className="h-[160px] p-3.5 rounded-xl bg-paper border border-rule hover:border-accent/50 shadow-xs transition-all flex flex-col justify-between group"
              >
                {/* Slot 1: Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {renderCountryBadge(mn.country)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink font-mono group-hover:text-accent transition-colors truncate max-w-[120px] sm:max-w-[150px]">
                          {mn.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-secondary border border-rule font-sans shrink-0">
                          {mn.countryName}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-ink-muted mt-0.5 block truncate">
                        {mn.ip}:{mn.port}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-semibold">
                      {mn.protocol}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {mn.latencyMs} ms
                    </span>
                  </div>
                </div>

                {/* Slot 2: Tags */}
                <div className="flex items-center gap-1.5 flex-wrap overflow-hidden h-6">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule font-mono">
                    客户端直连
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule font-mono">
                    千兆 BGP
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-mono">
                    智能分流引擎
                  </span>
                </div>

                {/* Slot 3: Bottom Status Footer with Outbound Route Pills or Quick Link */}
                <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[11px] font-mono h-8">
                  {chainedRelays.length > 0 ? (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-ink-muted flex items-center gap-1 text-[10px] shrink-0">
                        <ArrowsLeftRight className="w-3 h-3 text-purple-400" />
                        <span>已挂载出站:</span>
                      </span>
                      <div className="flex items-center gap-1 truncate">
                        {chainedRelays.map((r) => {
                          const targetUnlock = nodes.find(
                            (n) => n.id === (r.unlockNodeId || r.exitNodeId)
                          );
                          return (
                            <span
                              key={r.id}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-medium truncate"
                              title={`${r.name} (${r.mode === "all" ? "全量" : "智能分流"})`}
                            >
                              {renderCountryBadge(targetUnlock?.country, "sm")}
                              <span className="truncate max-w-[80px] sm:max-w-[100px]">{targetUnlock?.name || "解锁节点"}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] text-ink-muted flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rule-active" />
                        <span>未挂载解锁机 · 流量全直连</span>
                      </span>
                      <button
                        onClick={() => handleQuickAttach(mn.id)}
                        className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 border border-accent/30 transition-all font-mono cursor-pointer"
                      >
                        + 挂载解锁
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredMainNodes.length === 0 && (
            <div className="p-8 text-center text-xs font-mono text-ink-muted border border-dashed border-rule rounded-xl bg-paper/50 col-span-full">
              {searchQuery || activeUnlockFilter !== "all"
                ? "没有找到符合筛选条件的主力直连节点。"
                : "暂无主力直连节点，请在节点管理中添加类型为「主力直连机」的 VPS。"}
            </div>
          )}
        </div>
      </div>

      {/* 4. Active Chained Proxy Pipeline List */}
      <div className="bg-paper-2 rounded-2xl border border-rule p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-rule">
          <div className="text-xs font-mono uppercase tracking-wider text-ink-muted flex items-center gap-2">
            <Lightning weight="fill" className="w-3.5 h-3.5 text-accent" />
            <span className="font-semibold text-ink">当前活跃链式解锁链路</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-rule">
              {uniqueRelays.length} 条已生效
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {uniqueRelays.map((r) => {
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

                    {/* Path Visualization with Country Badges */}
                    <div className="flex items-center gap-2 mt-2 text-xs font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-paper-3 text-accent border border-accent/20 flex items-center gap-1.5 font-semibold">
                        {renderCountryBadge(main?.country, "sm")}
                        <span>{main?.name || "主力机"}</span>
                      </span>
                      <span className="text-ink-muted text-xs">➔</span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/25 flex items-center gap-1.5 font-semibold">
                        {renderCountryBadge(unlock?.country, "sm")}
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
                    onClick={() => setDeletingRelay(r)}
                    className="p-2 rounded-lg text-ink-muted hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                    title="解除该链式代理"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {uniqueRelays.length === 0 && (
            <div className="text-center py-8 text-xs font-mono text-ink-muted border border-dashed border-rule rounded-xl bg-paper/30">
              暂无配置的链式解锁代理。点击上方“创建链式解锁代理”即可将主力 VPS 与专属解锁机绑定。
            </div>
          )}
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
                label: `[${(n.country || 'UN').toUpperCase()}] ${n.name} (${n.ip})`,
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
                label: `[${(n.country || 'UN').toUpperCase()}] ${n.name} (${n.ip})`,
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

          {/* Inline Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
              <Warning weight="bold" className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

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

      {/* Custom Delete Confirmation Modal (Native Confirm Replacement) */}
      <Modal
        isOpen={!!deletingRelay}
        onClose={() => {
          if (!isDeleting) setDeletingRelay(null);
        }}
        title="解除链式解锁代理"
        subtitle="从主控撤销该链路配置并恢复直连出站"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
            <Warning weight="bold" className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-rose-200">
                确定要删除链路「{deletingRelay?.name}」吗？
              </p>
              <p className="text-rose-300/80 leading-relaxed">
                解除后，主控将撤销该主力节点上的 <code className="text-rose-200 font-mono">UNLOCK_OUT</code> 出站及对应 AI/流媒体分流规则。客户端经由该主力节点将自动恢复为纯直连出站。
              </p>
            </div>
          </div>

          {deletingRelay && (
            <div className="p-3.5 rounded-xl bg-paper-3/70 border border-rule text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span>主力节点:</span>
                <span className="text-ink font-semibold">
                  {nodes.find((n) => n.id === deletingRelay.mainNodeId || n.id === deletingRelay.transitNodeId)?.name || deletingRelay.mainNodeId}
                </span>
              </div>
              <div className="flex items-center justify-between text-ink-muted">
                <span>解锁节点:</span>
                <span className="text-purple-300 font-semibold">
                  {nodes.find((n) => n.id === deletingRelay.unlockNodeId || n.id === deletingRelay.exitNodeId)?.name || deletingRelay.unlockNodeId}
                </span>
              </div>
              <div className="flex items-center justify-between text-ink-muted">
                <span>分流策略:</span>
                <span className="text-accent font-semibold">
                  {deletingRelay.mode === "all" ? "全量链式出站" : "智能分流模式 (AI & 流媒体)"}
                </span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-rule flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeletingRelay(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={isDeleting}
              onClick={async () => {
                if (!deletingRelay) return;
                setIsDeleting(true);
                try {
                  await onDeleteRelay(deletingRelay.id);
                  setDeletingRelay(null);
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              确认删除链路
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
