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
  Sliders,
  PencilSimple,
  X,
  Check,
  Robot,
  FilmStrip,
  ChatCircleDots,
  CreditCard,
  GameController,
} from "@phosphor-icons/react";
import {
  UNLOCK_SERVICES,
  SERVICE_CATEGORIES,
  getServiceById,
  getDefaultAiMediaServiceIds,
  getCategoryServiceIds,
  getAllServiceIds,
} from "./serviceCatalog";

interface TopologyCanvasProps {
  nodes: NodeItem[];
  relays: RelayLink[];
  onAddRelay: (relayData: Partial<RelayLink>) => Promise<any>;
  onUpdateRelay?: (id: string, relayData: Partial<RelayLink>) => Promise<any>;
  onDeleteRelay: (id: string) => Promise<any>;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  nodes,
  relays,
  onAddRelay,
  onUpdateRelay,
  onDeleteRelay,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRelay, setEditingRelay] = useState<RelayLink | null>(null);

  const [name, setName] = useState("");
  const [mainId, setMainId] = useState("");
  const [unlockId, setUnlockId] = useState("");
  const [mode, setMode] = useState<"ai_media" | "all" | "custom">("ai_media");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customDomains, setCustomDomains] = useState<string[]>([]);
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState("all");
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");

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

  // Regional indicator badge
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "ai":
        return <Robot className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case "streaming":
        return <FilmStrip className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case "social":
        return <ChatCircleDots className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case "finance":
        return <CreditCard className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "gaming":
        return <GameController className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-ink-muted shrink-0" />;
    }
  };

  const getCategoryShortName = (category: string) => {
    switch (category) {
      case "ai":
        return "AI 模型";
      case "streaming":
        return "流媒体";
      case "social":
        return "社交";
      case "finance":
        return "金融";
      case "gaming":
        return "游戏";
      default:
        return "通用";
    }
  };

  const handleOpenAddModal = () => {
    setEditingRelay(null);
    if (mainNodes.length > 0) setMainId(mainNodes[0].id);
    if (unlockNodes.length > 0) setUnlockId(unlockNodes[0].id);
    setMode("ai_media");
    setSelectedServices(getDefaultAiMediaServiceIds());
    setCustomDomains([]);
    setCustomDomainInput("");
    setServiceCategoryFilter("all");
    setServiceSearchQuery("");
    setName(
      mainNodes[0] && unlockNodes[0]
        ? `${mainNodes[0].name.split("-")[0]}主力 ➔ ${unlockNodes[0].name.split("-")[0]}解锁`
        : "链式解锁代理"
    );
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleEditRelay = (relay: RelayLink) => {
    setEditingRelay(relay);
    setName(relay.name);
    setMainId(relay.mainNodeId || relay.transitNodeId || "");
    setUnlockId(relay.unlockNodeId || relay.exitNodeId || "");
    setMode(relay.mode || (relay.customServices && relay.customServices.length > 0 ? "custom" : "ai_media"));
    setSelectedServices(
      relay.customServices && relay.customServices.length > 0
        ? relay.customServices
        : getDefaultAiMediaServiceIds()
    );
    setCustomDomains(relay.customDomains || []);
    setCustomDomainInput("");
    setServiceCategoryFilter("all");
    setServiceSearchQuery("");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleQuickAttach = (directNodeId: string) => {
    setEditingRelay(null);
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
    setSelectedServices(getDefaultAiMediaServiceIds());
    setCustomDomains([]);
    setCustomDomainInput("");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleToggleService = (sId: string) => {
    setSelectedServices((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  const handleSelectAllServices = () => {
    setSelectedServices(getAllServiceIds());
  };

  const handleDeselectAllServices = () => {
    setSelectedServices([]);
  };

  const handleSelectCategory = (cat: string) => {
    const ids = getCategoryServiceIds(cat);
    setSelectedServices((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleSelectDefaultAiMedia = () => {
    setSelectedServices(getDefaultAiMediaServiceIds());
  };

  const handleAddCustomDomain = () => {
    const trimmed = customDomainInput.trim();
    if (!trimmed) return;
    const items = trimmed.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
    setCustomDomains((prev) => Array.from(new Set([...prev, ...items])));
    setCustomDomainInput("");
  };

  const handleRemoveCustomDomain = (targetDomain: string) => {
    setCustomDomains((prev) => prev.filter((d) => d !== targetDomain));
  };

  const handleSaveRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainId || !unlockId || submitting) return;

    if (mode === "custom" && selectedServices.length === 0 && customDomains.length === 0) {
      setErrorMessage("自定义分流模式下，请至少勾选一个服务或添加一个自定义域名");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload: Partial<RelayLink> = {
      name: name || "链式解锁代理",
      mainNodeId: mainId,
      unlockNodeId: unlockId,
      mode,
      customServices: mode === "custom" ? selectedServices : mode === "ai_media" ? getDefaultAiMediaServiceIds() : [],
      customDomains: mode === "custom" ? customDomains : [],
      transitNodeId: mainId,
      exitNodeId: unlockId,
      transitPort: 443,
    };

    try {
      let res;
      if (editingRelay && onUpdateRelay) {
        res = await onUpdateRelay(editingRelay.id, payload);
      } else {
        res = await onAddRelay(payload);
      }

      if (res && res.success === false) {
        setErrorMessage(res.message || "保存失败，请检查是否已存在相同链路");
        return;
      }
      setIsModalOpen(false);
      setEditingRelay(null);
      setName("");
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "网络异常或服务不可用");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered direct nodes by search query and active unlock gateway filter
  const filteredMainNodes = mainNodes.filter((mn) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      mn.name.toLowerCase().includes(q) ||
      mn.ip.includes(q) ||
      mn.countryName.toLowerCase().includes(q);

    if (!matchQuery) return false;
    if (activeUnlockFilter === "all") return true;

    const nodeChains = uniqueRelays.filter(
      (r) => r.mainNodeId === mn.id || r.transitNodeId === mn.id
    );
    if (activeUnlockFilter === "unbound") return nodeChains.length === 0;
    return nodeChains.some(
      (r) => r.unlockNodeId === activeUnlockFilter || r.exitNodeId === activeUnlockFilter
    );
  });

  // Services filtered for the modal picker
  const filteredServices = UNLOCK_SERVICES.filter((svc) => {
    if (serviceCategoryFilter !== "all" && svc.category !== serviceCategoryFilter) {
      return false;
    }
    if (!serviceSearchQuery.trim()) return true;
    const q = serviceSearchQuery.toLowerCase().trim();
    return (
      svc.name.toLowerCase().includes(q) ||
      svc.description.toLowerCase().includes(q) ||
      svc.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Topology Banner */}
      <div className="p-6 rounded-2xl bg-paper-2 border border-rule space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 mt-0.5">
              <ShareNetwork weight="bold" className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-semibold text-ink">
                  主力直连 + 链式解锁代理拓扑
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
                  Xray 智能路由分流
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-rule">
                  {uniqueRelays.length} 条生效链路
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed max-w-3xl">
                客户端直连主力海外 VPS 享受千兆极速；当访问 OpenAI、Claude、Netflix 等受风控服务时，主力机 Xray 智能路由引擎自动通过 Outbound 转发至原生住宅/双ISP 落地 VPS 出站。
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            icon={<Plus className="w-3.5 h-3.5" />}
            className="shrink-0 self-start lg:self-center font-medium"
          >
            创建链式解锁代理
          </Button>
        </div>

        {/* 4-Step Architecture Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
          <div className="p-2.5 rounded-xl bg-paper border border-rule flex items-center gap-2.5">
            <Laptop className="w-4 h-4 text-accent shrink-0" />
            <div className="truncate">
              <div className="text-[10px] font-semibold text-ink truncate">1. 客户端连接</div>
              <div className="text-[9px] text-ink-muted truncate">直连主力 VPS 极速延迟</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-paper border border-rule flex items-center gap-2.5">
            <Broadcast className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="truncate">
              <div className="text-[10px] font-semibold text-ink truncate">2. 主力入口机</div>
              <div className="text-[9px] text-ink-muted truncate">香港 / 日本 / 新加坡 BGP</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-paper border border-rule flex items-center gap-2.5">
            <Shuffle className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="truncate">
              <div className="text-[10px] font-semibold text-ink truncate">3. Xray 智能分流</div>
              <div className="text-[9px] text-ink-muted truncate">自定义/AI/Netflix 自动匹配</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-paper border border-rule flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="truncate">
              <div className="text-[10px] font-semibold text-ink truncate">4. 原生家宽落地</div>
              <div className="text-[9px] text-ink-muted truncate">双ISP 住宅级流量出口</div>
            </div>
          </div>
        </div>
      </div>

      {/* Part 1: Unlock Gateways Pool */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              流媒体 / AI 专属落地网关池 (Unlock Gateways)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {unlockNodes.length} 台落地网关
            </span>
          </div>

          <span className="text-[11px] font-mono text-ink-muted flex items-center gap-1">
            <Sparkle className="w-3.5 h-3.5 text-accent" />
            <span>原生纯净双ISP • 共享出站出口</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {unlockNodes.map((un) => {
            const servingRelays = uniqueRelays.filter(
              (r) => r.unlockNodeId === un.id || r.exitNodeId === un.id
            );

            return (
              <div
                key={un.id}
                className="p-4 rounded-xl bg-paper-2 border border-rule hover:border-purple-500/40 transition-all space-y-3 shadow-xs relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {renderCountryBadge(un.country, "md")}
                    <div>
                      <h4 className="text-xs font-bold text-ink font-mono truncate max-w-[140px] sm:max-w-[170px]">
                        {un.name}
                      </h4>
                      <span className="text-[10px] font-mono text-ink-muted block mt-0.5">
                        {un.ip}:{un.port}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-paper-3 text-emerald-400 border border-rule flex items-center gap-1 shrink-0 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{un.latencyMs} ms</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/25 font-mono font-medium">
                    {un.countryName} (原生住宅)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-mono">
                    {un.protocol.toUpperCase()}
                  </span>
                </div>

                <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-ink-muted flex items-center gap-1.5 text-[10px]">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>已为 {servingRelays.length} 台主力机提供解锁</span>
                  </span>

                  <button
                    onClick={() => {
                      setActiveUnlockFilter(
                        activeUnlockFilter === un.id ? "all" : un.id
                      );
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer font-mono ${
                      activeUnlockFilter === un.id
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : "bg-paper-3 text-ink-muted hover:text-ink border-rule"
                    }`}
                  >
                    {activeUnlockFilter === un.id ? "已高亮筛选" : "查看关联主力机"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ribbon Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-rule" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 py-1 bg-paper border border-rule rounded-full text-[10px] font-mono text-ink-muted flex items-center gap-1.5 shadow-xs">
            <Shuffle className="w-3 h-3 text-accent" />
            <span>Xray 智能路由分流层 • 相对流量出站至上方落地网关 • 常规流量全直连</span>
          </span>
        </div>
      </div>

      {/* Part 2: Direct Fleet with Search & Filtering */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              主力直连节点集群 (Direct Inbound Fleet)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              共 {mainNodes.length} 台
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-48 sm:w-56">
              <MagnifyingGlass className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索名称 / IP / 地区..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-paper border border-rule text-xs text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div className="flex bg-paper border border-rule rounded-lg p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setActiveUnlockFilter("all")}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                  activeUnlockFilter === "all"
                    ? "bg-accent/15 text-accent font-bold"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                全部 ({mainNodes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveUnlockFilter("unbound")}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                  activeUnlockFilter === "unbound"
                    ? "bg-accent/15 text-accent font-bold"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                纯直连 (
                {
                  mainNodes.filter(
                    (m) =>
                      !uniqueRelays.some(
                        (r) => r.mainNodeId === m.id || r.transitNodeId === m.id
                      )
                  ).length
                }
                )
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredMainNodes.map((mn) => {
            const chainedRelays = uniqueRelays.filter(
              (r) => r.mainNodeId === mn.id || r.transitNodeId === mn.id
            );

            return (
              <div
                key={mn.id}
                className="p-4 rounded-xl bg-paper-2 border border-rule hover:border-accent/40 transition-all space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {renderCountryBadge(mn.country, "md")}
                    <div>
                      <h4 className="text-xs font-bold text-ink font-mono truncate max-w-[140px] sm:max-w-[170px]">
                        {mn.name}
                      </h4>
                      <span className="text-[10px] font-mono text-ink-muted block mt-0.5">
                        {mn.ip}:{mn.port}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-paper-3 text-emerald-400 border border-rule flex items-center gap-1 shrink-0 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{mn.latencyMs} ms</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/25 font-mono font-medium">
                    {mn.countryName}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-mono">
                    {mn.protocol.toUpperCase()}
                  </span>
                </div>

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
                          const modeText =
                            r.mode === "all"
                              ? "全量"
                              : r.mode === "custom"
                              ? `自定义(${r.customServices?.length || 0})`
                              : "智能分流";
                          return (
                            <span
                              key={r.id}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-medium truncate"
                              title={`${r.name} (${modeText})`}
                            >
                              {renderCountryBadge(targetUnlock?.country, "sm")}
                              <span className="truncate max-w-[100px] sm:max-w-[140px]">
                                {targetUnlock?.name || "解锁节点"}
                              </span>
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
        </div>
      </div>

      {/* Part 3: Active Chained Relays List */}
      <div className="p-6 rounded-2xl bg-paper-2 border border-rule space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lightning weight="bold" className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-semibold text-ink">
              当前活跃链式解锁链路
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-rule">
              {uniqueRelays.length} 条生效
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
            const isAiMediaMode = r.mode === "ai_media" || (!r.mode && (!r.customServices || r.customServices.length === 0));
            const isCustomMode = r.mode === "custom";
            const isAllMode = r.mode === "all";

            return (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-paper border border-rule hover:border-rule-active transition-all shadow-xs gap-4"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                    <ArrowsLeftRight weight="bold" className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold text-ink font-sans">
                        {r.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${
                          isCustomMode
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : isAiMediaMode
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                        }`}
                      >
                        {isCustomMode ? (
                          <>
                            <Sliders className="w-3 h-3" />
                            <span>自定义分流 ({r.customServices?.length || 0} 个服务)</span>
                          </>
                        ) : isAiMediaMode ? (
                          "AI & 流媒体专属解锁"
                        ) : (
                          "全量链式出站"
                        )}
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

                    {/* Services Pill Preview Row */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      <span className="text-[11px] text-ink-muted shrink-0 flex items-center gap-1">
                        <Sparkle className="w-3 h-3 text-accent" />
                        <span>分流规则:</span>
                      </span>
                      {isAllMode ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          全量出站 (所有请求无条件经由落地节点)
                        </span>
                      ) : isCustomMode ? (
                        r.customServices && r.customServices.length > 0 ? (
                          <>
                            {r.customServices.slice(0, 5).map((sId) => {
                              const svc = getServiceById(sId);
                              return (
                                <span
                                  key={sId}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule"
                                >
                                  {svc?.name.split(" ")[0] || sId}
                                </span>
                              );
                            })}
                            {r.customServices.length > 5 && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-medium">
                                +{r.customServices.length - 5} 个服务
                              </span>
                            )}
                            {r.customDomains && r.customDomains.length > 0 && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                +{r.customDomains.length} 自定义域名
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] font-mono text-ink-muted italic">
                            未勾选特定服务 (默认直连)
                          </span>
                        )
                      ) : (
                        <>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            OpenAI
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Claude
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Netflix
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Disney+
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            YouTube
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            等 15 个主流 AI & 流媒体
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-rule/50">
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-ink-muted block">综合链路时延</span>
                    <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {r.latencyMs} ms
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditRelay(r)}
                      className="p-2 rounded-lg text-ink-muted hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all cursor-pointer"
                      title="编辑链路与分流服务"
                    >
                      <PencilSimple className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingRelay(r)}
                      className="p-2 rounded-lg text-ink-muted hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                      title="解除该链式代理"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
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

      {/* Add / Edit Chained Relay Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRelay(null);
        }}
        title={editingRelay ? "编辑链式分流服务" : "创建链式解锁代理"}
        subtitle={
          editingRelay
            ? "调整该链路的出站分流模式与走落地节点的专属服务"
            : "将主力直连 VPS 与原生住宅/解锁 VPS 建立 Xray 链式出站与智能分流"
        }
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveRelay} className="space-y-4 text-sm font-sans">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Main Node Select */}
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                主力直连节点 (客户端接入节点) *
              </label>
              <Select
                options={mainNodes.map((n) => ({
                  value: n.id,
                  label: `${n.name} (${n.ip})`,
                  badge: (n.country || "UN").toUpperCase(),
                  desc: `${n.countryName} • 延迟: ${n.latencyMs}ms • 协议: ${n.protocol.toUpperCase()}`,
                }))}
                value={mainId}
                onChange={(val) => setMainId(val)}
              />
            </div>

            {/* Unlock Node Select */}
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                专属落地节点 (目标出站解锁节点) *
              </label>
              <Select
                options={unlockNodes.map((n) => ({
                  value: n.id,
                  label: `${n.name} (${n.ip})`,
                  badge: (n.country || "UN").toUpperCase(),
                  desc: `${n.countryName} • 特征: ${n.tags?.join(", ") || "原生双ISP住宅"} • 延迟: ${n.latencyMs}ms`,
                }))}
                value={unlockId}
                onChange={(val) => setUnlockId(val)}
              />
            </div>
          </div>

          {/* Mode Segmented Cards */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">
              解锁分流模式 *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* 1. 智能分流模式 */}
              <div
                onClick={() => setMode("ai_media")}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  mode === "ai_media"
                    ? "bg-accent/10 border-accent shadow-xs text-ink ring-1 ring-accent/30"
                    : "bg-paper-2 border-rule hover:border-rule-active hover:bg-paper-3/40 text-ink-secondary"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-ink">
                      <Lightning weight="fill" className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>智能分流</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                      推荐
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    主流 AI 与流媒体 (15+ 服务) 走落地机，常规流量直连直出
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-rule/50 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-ink-muted">开箱即用免配置</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      mode === "ai_media" ? "bg-accent ring-2 ring-accent/30" : "bg-paper-3 border border-rule"
                    }`}
                  />
                </div>
              </div>

              {/* 2. 手动定制模式 */}
              <div
                onClick={() => setMode("custom")}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  mode === "custom"
                    ? "bg-accent/10 border-accent shadow-xs text-ink ring-1 ring-accent/30"
                    : "bg-paper-2 border-rule hover:border-rule-active hover:bg-paper-3/40 text-ink-secondary"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-ink">
                      <Sliders weight="bold" className="w-4 h-4 text-accent shrink-0" />
                      <span>手动定制</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-semibold">
                      自由定制
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    精准勾选走落地机出口的具体应用与域名规则，未勾选的全直连
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-rule/50 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-ink-muted">已选 {selectedServices.length} 个服务</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      mode === "custom" ? "bg-accent ring-2 ring-accent/30" : "bg-paper-3 border border-rule"
                    }`}
                  />
                </div>
              </div>

              {/* 3. 全量中继模式 */}
              <div
                onClick={() => setMode("all")}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  mode === "all"
                    ? "bg-accent/10 border-accent shadow-xs text-ink ring-1 ring-accent/30"
                    : "bg-paper-2 border-rule hover:border-rule-active hover:bg-paper-3/40 text-ink-secondary"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-ink">
                      <Globe weight="bold" className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>全量链式</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold">
                      全量
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    主力机仅为前跳中继，全部出站流量经落地机，彻底隐藏主力 IP
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-rule/50 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-ink-muted">全流量中继出站</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      mode === "all" ? "bg-accent ring-2 ring-accent/30" : "bg-paper-3 border border-rule"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Custom Services Picker (Only visible when mode === 'custom') */}
          {mode === "custom" && (
            <div className="p-4 rounded-xl bg-paper-2 border border-accent/30 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rule">
                <div className="flex items-center gap-2">
                  <Sliders weight="bold" className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-xs font-bold text-ink">
                    手动选择分流服务
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-semibold whitespace-nowrap">
                    已选择 {selectedServices.length} / {UNLOCK_SERVICES.length}
                  </span>
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
                  <button
                    type="button"
                    onClick={handleSelectDefaultAiMedia}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30 transition-all cursor-pointer font-medium shadow-xs"
                  >
                    常用推荐
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory("ai")}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-paper border border-rule hover:border-accent/40 text-ink-secondary hover:text-ink transition-all cursor-pointer font-medium"
                  >
                    + 全选 AI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory("streaming")}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-paper border border-rule hover:border-accent/40 text-ink-secondary hover:text-ink transition-all cursor-pointer font-medium"
                  >
                    + 全选流媒体
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllServices}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-paper border border-rule hover:border-accent/40 text-ink-secondary hover:text-ink transition-all cursor-pointer font-medium"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllServices}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-paper border border-rule hover:border-rose-500/40 text-rose-400 hover:text-rose-300 transition-all cursor-pointer font-medium"
                  >
                    清空
                  </button>
                </div>
              </div>

              {/* Category Filter Pills & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setServiceCategoryFilter("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      serviceCategoryFilter === "all"
                        ? "bg-accent/15 text-accent border border-accent/40 font-semibold"
                        : "bg-paper text-ink-muted border border-rule hover:text-ink"
                    }`}
                  >
                    全部 ({UNLOCK_SERVICES.length})
                  </button>
                  {SERVICE_CATEGORIES.map((cat) => {
                    const count = UNLOCK_SERVICES.filter((s) => s.category === cat.id).length;
                    const isCatActive = serviceCategoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setServiceCategoryFilter(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                          isCatActive
                            ? "bg-accent/15 text-accent border border-accent/40 font-semibold"
                            : "bg-paper text-ink-muted border border-rule hover:text-ink"
                        }`}
                      >
                        {getCategoryIcon(cat.id)}
                        <span>{cat.name}</span>
                        <span className="text-[10px] font-mono opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-48 shrink-0">
                  <MagnifyingGlass className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={serviceSearchQuery}
                    onChange={(e) => setServiceSearchQuery(e.target.value)}
                    placeholder="搜索服务名称..."
                    className="w-full pl-8 pr-7 py-1 rounded-lg bg-paper border border-rule text-xs text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-accent font-sans"
                  />
                  {serviceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setServiceSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Service Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-76 overflow-y-auto pr-1">
                {filteredServices.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-xs font-mono text-ink-muted bg-paper/50 rounded-xl border border-dashed border-rule">
                    未找到匹配的分流服务
                  </div>
                ) : (
                  filteredServices.map((svc) => {
                    const isChecked = selectedServices.includes(svc.id);
                    return (
                      <div
                        key={svc.id}
                        onClick={() => handleToggleService(svc.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 relative group ${
                          isChecked
                            ? "bg-accent/10 border-accent/60 shadow-xs text-ink ring-1 ring-accent/20"
                            : "bg-paper border-rule hover:border-rule-active hover:bg-paper-2 text-ink-secondary hover:text-ink"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 transition-colors border ${
                            isChecked
                              ? "bg-accent border-accent text-white"
                              : "border-rule bg-paper-2 group-hover:border-ink-muted"
                          }`}
                        >
                          {isChecked && <Check weight="bold" className="w-3 h-3 text-paper" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-bold text-ink leading-tight truncate">
                              {svc.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-paper-3/80 text-ink-muted shrink-0 border border-rule/40 flex items-center gap-1">
                              {getCategoryIcon(svc.category)}
                              <span>{getCategoryShortName(svc.category)}</span>
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted line-clamp-1 mt-1 leading-normal">
                            {svc.description}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Custom Domains Extra Section */}
              <div className="pt-2.5 border-t border-rule space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-accent" />
                    <span>附加自定义域名 / Geosite 规则 (可选):</span>
                  </label>
                  <span className="text-[10px] text-ink-muted">
                    按回车或点添加，支持多个域名或 geosite 规则
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    value={customDomainInput}
                    onChange={(e) => setCustomDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomDomain();
                      }
                    }}
                    placeholder="例如: example.com, geosite:github, 1.1.1.1"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddCustomDomain}
                    disabled={!customDomainInput.trim()}
                  >
                    添加规则
                  </Button>
                </div>

                {/* Custom Domains Chips */}
                {customDomains.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {customDomains.map((dom) => (
                      <span
                        key={dom}
                        className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-paper border border-accent/30 text-accent flex items-center gap-1.5 shadow-xs"
                      >
                        <span>{dom}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomDomain(dom)}
                          className="hover:text-rose-400 cursor-pointer text-ink-muted transition-colors"
                          title="删除"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Architecture Explanatory Banner */}
          <div className="p-3.5 rounded-xl bg-paper-3/60 border border-rule text-xs text-ink-secondary space-y-1.5">
            <div className="font-semibold text-accent flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>工作原理说明</span>
            </div>
            <p className="leading-relaxed text-[11px] text-ink-muted">
              保存后，主控将为该主力节点动态生成专属 Xray 服务端配置，注入 <code>UNLOCK_OUT</code> 出站及对应分流规则。客户端只需导入主力节点订阅，即可享受原生流媒体与 AI 的极速解锁，无需客户端任何额外规则配置。
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
              onClick={() => {
                setIsModalOpen(false);
                setEditingRelay(null);
              }}
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
              {editingRelay ? "保存分流设置" : "保存并下发链式规则"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Custom Delete Confirmation Modal */}
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
                解除后，主控将撤销该主力节点上的 <code className="text-rose-200 font-mono">UNLOCK_OUT</code> 出站及对应分流规则。客户端经由该主力节点将自动恢复为纯直连出站。
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
                  {deletingRelay.mode === "all"
                    ? "全量链式出站"
                    : deletingRelay.mode === "custom"
                    ? `自定义分流 (${deletingRelay.customServices?.length || 0} 个服务)`
                    : "智能分流模式 (AI & 流媒体)"}
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
