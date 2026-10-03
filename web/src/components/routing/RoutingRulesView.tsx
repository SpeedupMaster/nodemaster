import React, { useState } from "react";
import {
  RoutingRule,
  NodeItem,
} from "../../types";
import { RuleModal } from "./RuleModal";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { Tooltip } from "../common/Tooltip";
import {
  ArrowsSplit,
  Plus,
  ArrowUp,
  ArrowDown,
  PencilSimple,
  Trash,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Lightning,
  Sparkle,
  Television,
  ChatCircleText,
  GameController,
  HandPalm,
  GlobeHemisphereEast,
  Code,
  MagnifyingGlass,
  ArrowRight,
  ArrowsClockwise,
  SlidersHorizontal,
  Warning,
  ListBullets,
  Tag,
} from "@phosphor-icons/react";

interface RoutingRulesViewProps {
  rules: RoutingRule[];
  nodes: NodeItem[];
  onAddRule: (rule: Partial<RoutingRule>) => Promise<any>;
  onUpdateRule: (id: string, updates: Partial<RoutingRule>) => Promise<any>;
  onDeleteRule: (id: string) => Promise<any>;
  onReorderRules: (ids: string[]) => Promise<any>;
  onResetRules: () => Promise<any>;
}

// Preset library for one-click addition
const PRESET_TEMPLATES = [
  {
    presetId: "preset_ai",
    name: "AI 办公全家桶 (OpenAI / Claude / Gemini)",
    description: "智能导向落地解锁机，保障 ChatGPT、Claude 与 Gemini 网页与 API 稳定可用",
    icon: Sparkle,
    color: "from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400",
    targetOutbound: "UNLOCK_OUT" as const,
    geosite: ["openai", "anthropic", "category-ai-chat-!cn"],
    domains: ["openai.com", "chatgpt.com", "oaistatic.com", "oaiusercontent.com", "claude.ai", "anthropic.com", "gemini.google.com"],
  },
  {
    presetId: "preset_streaming",
    name: "全球主流流媒体解锁",
    description: "Netflix / Disney+ / YouTube / TikTok 自动路由至流媒体原生解锁落地机",
    icon: Television,
    color: "from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400",
    targetOutbound: "UNLOCK_OUT" as const,
    geosite: ["netflix", "disney", "youtube", "tiktok", "spotify"],
    domains: ["netflix.com", "disneyplus.com", "youtube.com", "tiktok.com"],
  },
  {
    presetId: "preset_telegram",
    name: "Telegram 海外即时通讯",
    description: "Telegram 专属 IP 与域名通过代理出口极速分流直达，秒开大图与视频",
    icon: ChatCircleText,
    color: "from-sky-500/20 to-blue-500/10 border-sky-500/30 text-sky-400",
    targetOutbound: "PROXY" as const,
    geosite: ["telegram"],
    geoip: ["telegram"],
  },
  {
    presetId: "preset_gaming",
    name: "国际主流游戏联机平台",
    description: "Steam / Epic / PlayStation / Xbox / 暴雪战网高速中继，降低联机延迟与丢包",
    icon: GameController,
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400",
    targetOutbound: "PROXY" as const,
    geosite: ["steam", "epicgames", "ea", "blizzard", "playstation", "xbox"],
    domains: ["steampowered.com", "steamcommunity.com", "epicgames.com"],
  },
  {
    presetId: "preset_p2p",
    name: "BitTorrent / P2P 防封拦截",
    description: "阻断 BT/PT 下载协议流量，防止 VPS 机房受到版权投诉或封禁实例",
    icon: HandPalm,
    color: "from-red-500/20 to-rose-500/10 border-red-500/30 text-red-400",
    targetOutbound: "BLOCK" as const,
    protocol: ["bittorrent"],
  },
  {
    presetId: "preset_cn",
    name: "中国大陆流量直连",
    description: "国内域名与 IP 直连访问，降低网络延迟并节省 VPS 宝贵带宽月流量",
    icon: GlobeHemisphereEast,
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400",
    targetOutbound: "DIRECT" as const,
    geosite: ["cn"],
    geoip: ["cn"],
  },
  {
    presetId: "preset_dev",
    name: "海外开发与开源技术栈",
    description: "GitHub, Docker Hub, HuggingFace, Vercel, npm, AWS 开发者全套服务极速加速",
    icon: Code,
    color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-400",
    targetOutbound: "PROXY" as const,
    geosite: ["github", "docker"],
    domains: ["github.com", "githubusercontent.com", "docker.com", "huggingface.co", "vercel.app", "npmjs.org"],
  },
];

export const RoutingRulesView: React.FC<RoutingRulesViewProps> = ({
  rules,
  nodes,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onReorderRules,
  onResetRules,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);

  // Custom Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "确认",
    onConfirm: () => {},
  });

  // Simulator state
  const [simTarget, setSimTarget] = useState("");
  const [simResult, setSimResult] = useState<{
    matched: boolean;
    target: string;
    ruleId: string | null;
    ruleName: string;
    priority: number;
    action: string;
    reason: string;
  } | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Statistics calculation
  const totalCount = rules.length;
  const activeCount = rules.filter((r) => r.enabled).length;
  const unlockCount = rules.filter((r) => r.enabled && r.targetOutbound === "UNLOCK_OUT").length;
  const directCount = rules.filter((r) => r.enabled && r.targetOutbound === "DIRECT").length;
  const blockCount = rules.filter((r) => r.enabled && r.targetOutbound === "BLOCK").length;
  const proxyCount = rules.filter((r) => r.enabled && r.targetOutbound === "PROXY").length;

  // Handlers
  const handleOpenAdd = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: RoutingRule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleToggleEnabled = async (rule: RoutingRule) => {
    await onUpdateRule(rule.id, { enabled: !rule.enabled });
  };

  // Reordering handlers
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const temp = sorted[index];
    sorted[index] = sorted[index - 1];
    sorted[index - 1] = temp;
    await onReorderRules(sorted.map((r) => r.id));
  };

  const handleMoveDown = async (index: number) => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    if (index === sorted.length - 1) return;
    const temp = sorted[index];
    sorted[index] = sorted[index + 1];
    sorted[index + 1] = temp;
    await onReorderRules(sorted.map((r) => r.id));
  };

  // Delete with Custom Confirm Modal
  const handleDeleteClick = (rule: RoutingRule) => {
    setConfirmModal({
      isOpen: true,
      title: "删除分流规则确认",
      message: `确定要永久删除规则「${rule.name}」吗？删除后该规则的流量匹配将失效。`,
      confirmText: "确认删除",
      onConfirm: async () => {
        await onDeleteRule(rule.id);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Reset to presets with Custom Confirm Modal
  const handleResetClick = () => {
    setConfirmModal({
      isOpen: true,
      title: "重置为默认分流规则库",
      message: "此操作将清除所有自定义规则，并恢复为系统推荐的最佳实践预设规则库。是否继续？",
      confirmText: "确认重置",
      onConfirm: async () => {
        await onResetRules();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // One-click Preset Import
  const handleImportPreset = async (preset: typeof PRESET_TEMPLATES[0]) => {
    // Check if duplicate already exists by name or presetId
    const exists = rules.find(
      (r) => r.builtInPresetId === preset.presetId || r.name === preset.name
    );
    if (exists) {
      alert(`预设「${preset.name}」已存在于规则列表中，可直接进行编辑。`);
      return;
    }

    await onAddRule({
      name: preset.name,
      description: preset.description,
      enabled: true,
      targetOutbound: preset.targetOutbound,
      geosite: preset.geosite || [],
      domains: preset.domains || [],
      geoip: (preset as any).geoip || [],
      protocol: (preset as any).protocol || [],
      builtInPresetId: preset.presetId,
    });
  };

  // Run simulation test
  const handleRunSimulate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!simTarget.trim()) return;

    setSimLoading(true);
    try {
      const res = await fetch("/api/routing/rules/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: simTarget.trim() }),
      }).then((r) => r.json());

      if (res.success) {
        setSimResult(res.data);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  };

  // Outbound target rendering badge
  const renderOutboundBadge = (outbound: string) => {
    switch (outbound) {
      case "DIRECT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            DIRECT 直连
          </span>
        );
      case "BLOCK":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            BLOCK 阻断
          </span>
        );
      case "UNLOCK_OUT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            UNLOCK 落地解锁
          </span>
        );
      case "PROXY":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold font-mono bg-accent/10 text-accent border border-accent/20">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            PROXY 节点代理
          </span>
        );
    }
  };

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      {/* 1. Statistics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-paper-2 border border-rule rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-muted font-mono uppercase">规则总数</div>
            <div className="text-xl font-bold font-mono text-ink mt-0.5">{totalCount}</div>
          </div>
          <div className="p-2 rounded bg-paper-3 text-ink-secondary">
            <ListBullets className="w-4 h-4 text-accent" />
          </div>
        </div>

        <div className="bg-paper-2 border border-rule rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-muted font-mono uppercase">生效运行中</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{activeCount}</div>
          </div>
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-paper-2 border border-rule rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-muted font-mono uppercase">落地机解锁</div>
            <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">{unlockCount}</div>
          </div>
          <div className="p-2 rounded bg-purple-500/10 text-purple-400">
            <Sparkle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-paper-2 border border-rule rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-muted font-mono uppercase">直连直通</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{directCount}</div>
          </div>
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">
            <Lightning className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-paper-2 border border-rule rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-muted font-mono uppercase">安全阻断</div>
            <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">{blockCount}</div>
          </div>
          <div className="p-2 rounded bg-rose-500/10 text-rose-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-paper-2 border border-rule rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-muted font-mono uppercase">代理出口</div>
            <div className="text-xl font-bold font-mono text-accent mt-0.5">{proxyCount}</div>
          </div>
          <div className="p-2 rounded bg-accent/10 text-accent">
            <ArrowsSplit className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 2. One-Click Preset Import Gallery */}
      <div className="bg-paper-2 border border-rule rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">
              常用分流模板一键导入 (Preset Library)
            </h2>
          </div>
          <span className="text-xs text-ink-muted hidden sm:inline">
            无需手动翻阅复杂规则文档，点击一键载入开箱即用规则
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
          {PRESET_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const isInstalled = rules.some(
              (r) => r.builtInPresetId === tpl.presetId || r.name === tpl.name
            );

            return (
              <div
                key={tpl.presetId}
                className={`p-3.5 rounded-lg border bg-gradient-to-br transition-all flex flex-col justify-between ${tpl.color}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-xs text-ink">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{tpl.name.split(" ")[0]}</span>
                    </div>
                    {renderOutboundBadge(tpl.targetOutbound)}
                  </div>
                  <p className="text-[11px] text-ink-secondary leading-relaxed line-clamp-2">
                    {tpl.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-rule/50 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-ink-muted">
                    {(tpl.geosite?.length || 0) + (tpl.domains?.length || 0)} 项匹配
                  </span>
                  {isInstalled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      <CheckCircle className="w-3 h-3" />
                      已载入
                    </span>
                  ) : (
                    <button
                      onClick={() => handleImportPreset(tpl)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink hover:text-accent bg-paper px-2 py-0.5 rounded border border-rule hover:border-accent transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      快速添加
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Live Simulation & Match Test Bar */}
      <div className="bg-paper-2 border border-rule rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MagnifyingGlass className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
              分流规则命中模拟测试器 (Traffic Route Simulator)
            </h3>
          </div>
          <span className="text-[11px] text-ink-muted font-mono">
            自上而下逐条匹配 (First-match-wins)
          </span>
        </div>

        <form onSubmit={handleRunSimulate} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={simTarget}
              onChange={(e) => setSimTarget(e.target.value)}
              placeholder="输入目标域名或 IP 测试命中 (如 api.openai.com, 114.114.114.114, 192.168.1.1, github.com)..."
              className="w-full bg-paper border border-rule rounded-md px-3.5 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent pr-20"
            />
            {simTarget && (
              <button
                type="button"
                onClick={() => {
                  setSimTarget("");
                  setSimResult(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink"
              >
                清除
              </button>
            )}
          </div>
          <Button type="submit" variant="primary" disabled={simLoading || !simTarget.trim()}>
            {simLoading ? "测试中..." : "测试分流命中"}
          </Button>
        </form>

        {/* Simulation Result Badge */}
        {simResult && (
          <div className="p-3 bg-paper border border-accent/30 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">
                    {simResult.target}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted" />
                  <span className="text-xs text-accent font-semibold">
                    {simResult.ruleName}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule">
                    优先级 #{simResult.priority}
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  {simResult.reason}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-ink-secondary">分流出口:</span>
              {renderOutboundBadge(simResult.action)}
            </div>
          </div>
        )}
      </div>

      {/* 4. Main Rules Table / List */}
      <div className="bg-paper-2 border border-rule rounded-lg overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-rule flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-paper-2/90">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">规则编排与优先级调序</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-paper-3 text-ink-secondary border border-rule font-mono">
                {rules.length} 条已配置
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              流量请求将按照列表序号从上往下依次匹配，命中即退出
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={handleResetClick}
              className="text-xs"
            >
              <ArrowsClockwise className="w-3.5 h-3.5 mr-1" />
              重置为默认
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenAdd}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              新建分流规则
            </Button>
          </div>
        </div>

        {/* Rules Cards / Rows */}
        {sortedRules.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ArrowsSplit className="w-10 h-10 text-ink-muted mx-auto" />
            <p className="text-sm text-ink-secondary">暂无分流规则</p>
            <Button variant="primary" onClick={handleResetClick}>
              载入官方最佳实践预设
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-rule">
            {sortedRules.map((rule, idx) => {
              const hasDomains = (rule.domains && rule.domains.length > 0) || (rule.geosite && rule.geosite.length > 0);
              const hasIps = (rule.ips && rule.ips.length > 0) || (rule.geoip && rule.geoip.length > 0);
              const hasProtocols = rule.protocol && rule.protocol.length > 0;
              const hasPorts = !!rule.port;
              const isFirst = idx === 0;
              const isLast = idx === sortedRules.length - 1;

              return (
                <div
                  key={rule.id}
                  className={`p-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    rule.enabled ? "hover:bg-paper-hover/40" : "bg-paper-3/30 opacity-60"
                  }`}
                >
                  {/* Left Column: Priority, Toggle, Name, Conditions */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Priority Controller */}
                    <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0 pt-0.5">
                      <Tooltip content="上移提高优先级">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveUp(idx)}
                          className={`p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors ${
                            isFirst ? "opacity-20 cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      <span className="text-xs font-mono font-bold text-ink-muted px-1">
                        #{String(rule.priority).padStart(2, "0")}
                      </span>
                      <Tooltip content="下移降低优先级">
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveDown(idx)}
                          className={`p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors ${
                            isLast ? "opacity-20 cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>

                    {/* Enable Switch */}
                    <div className="pt-1 flex-shrink-0">
                      <Tooltip content={rule.enabled ? "点击停用" : "点击启用"}>
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(rule)}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            rule.enabled ? "bg-accent" : "bg-paper-3 border border-rule"
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              rule.enabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </Tooltip>
                    </div>

                    {/* Info & Badges */}
                    <div className="min-w-0 space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink leading-tight">
                          {rule.name}
                        </span>

                        {rule.builtInPresetId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule">
                            内置预设
                          </span>
                        )}

                        {renderOutboundBadge(rule.targetOutbound)}

                        {rule.targetOutbound === "PROXY" && rule.targetNodeId && (
                          <span className="text-[11px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                            指定: {nodes.find((n) => n.id === rule.targetNodeId)?.name || rule.targetNodeId}
                          </span>
                        )}
                      </div>

                      {rule.description && (
                        <p className="text-xs text-ink-muted leading-relaxed">
                          {rule.description}
                        </p>
                      )}

                      {/* Matching Conditions Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {/* Scope */}
                        {rule.inboundNodeIds && rule.inboundNodeIds.length > 0 ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            仅 {rule.inboundNodeIds.length} 个节点生效
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule">
                            全节点生效
                          </span>
                        )}

                        {/* Geosites */}
                        {rule.geosite?.map((g) => (
                          <span
                            key={g}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20"
                          >
                            geosite:{g}
                          </span>
                        ))}

                        {/* Domains */}
                        {rule.domains?.slice(0, 3).map((d) => (
                          <span
                            key={d}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule"
                          >
                            {d}
                          </span>
                        ))}
                        {rule.domains && rule.domains.length > 3 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 text-ink-muted">
                            +{rule.domains.length - 3} 个域名
                          </span>
                        )}

                        {/* GeoIP */}
                        {rule.geoip?.map((g) => (
                          <span
                            key={g}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          >
                            geoip:{g}
                          </span>
                        ))}

                        {/* IPs */}
                        {rule.ips?.slice(0, 2).map((ip) => (
                          <span
                            key={ip}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule"
                          >
                            {ip}
                          </span>
                        ))}
                        {rule.ips && rule.ips.length > 2 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 text-ink-muted">
                            +{rule.ips.length - 2} 个网段
                          </span>
                        )}

                        {/* Protocols */}
                        {rule.protocol?.map((p) => (
                          <span
                            key={p}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20"
                          >
                            protocol:{p}
                          </span>
                        ))}

                        {/* Port */}
                        {rule.port && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule">
                            port:{rule.port}
                          </span>
                        )}

                        {!hasDomains && !hasIps && !hasProtocols && !hasPorts && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule">
                            (兜底全流量匹配)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Edit / Delete */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 self-end lg:self-center">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleOpenEdit(rule)}
                      className="px-2.5 py-1.5 text-xs text-ink"
                    >
                      <PencilSimple className="w-3.5 h-3.5 mr-1 text-ink-muted" />
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleDeleteClick(rule)}
                      className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Rule Add/Edit Modal */}
      <RuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rule={editingRule}
        nodes={nodes}
        onSave={async (data) => {
          if (editingRule) {
            await onUpdateRule(editingRule.id, data);
          } else {
            await onAddRule(data);
          }
        }}
      />

      {/* Cobalt Custom Confirm Modal (No browser alerts!) */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-rose-500/10 text-rose-400 flex-shrink-0 mt-0.5">
              <Warning className="w-5 h-5" />
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              {confirmModal.message}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-rule">
            <Button
              variant="secondary"
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
            >
              取消
            </Button>
            <Button
              variant="primary"
              className="bg-rose-600 hover:bg-rose-500 text-white"
              onClick={confirmModal.onConfirm}
            >
              {confirmModal.confirmText}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
