import React, { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { NodeItem, NodeInput } from "../../types";
import { api } from "../../services/api";
import { NodeCard } from "./NodeCard";
import { NodeTable } from "./NodeTable";
import { buildNodeShareUrl } from "../../utils/nodeLink";
import { ConfigModal } from "./ConfigModal";
import { InstallModal } from "./InstallModal";
import { NodeForm } from "./NodeForm";
import { XrayVersionModal } from "./XrayVersionModal";
import { ProbeVersionModal } from "./ProbeVersionModal";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { MagnifyingGlass, ShieldCheck, Cpu, SquaresFour, Rows } from "@phosphor-icons/react";

gsap.registerPlugin(useGSAP);

interface NodeListProps {
  nodes: NodeItem[];
  onResetTraffic: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, input: NodeInput) => Promise<unknown>;
  onRefreshData?: () => void;
  onOpenNode?: (node: NodeItem) => void;
}

export const NodeList: React.FC<NodeListProps> = ({
  nodes,
  onResetTraffic,
  onDelete,
  onUpdate,
  onRefreshData,
  onOpenNode,
}) => {
  const [view, setView] = useState<"grid" | "table">(() =>
    localStorage.getItem("nodemaster-nodes-view") === "table" ? "table" : "grid"
  );
  useEffect(() => localStorage.setItem("nodemaster-nodes-view", view), [view]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeConfigNode, setActiveConfigNode] = useState<NodeItem | null>(null);
  const [activeInstallNode, setActiveInstallNode] = useState<NodeItem | null>(null);
  const [activeEditNode, setActiveEditNode] = useState<NodeItem | null>(null);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isProbeVersionModalOpen, setIsProbeVersionModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredNodes = nodes.filter((node) => {
    const matchSearch =
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.ip.includes(search) ||
      node.countryName.toLowerCase().includes(search.toLowerCase()) ||
      node.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;
    if (typeFilter === "all") return true;
    if (typeFilter === "direct") return node.type === "direct";
    if (typeFilter === "unlock") return node.type === "unlock";
    if (typeFilter === "probe") return node.type === "probe";
    if (typeFilter === "circuit_broken") return node.status === "circuit_broken";
    return true;
  });

  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.from(".node-card-wrap", {
      opacity: 0,
      y: 16,
      stagger: 0.05,
      duration: 0.5,
      ease: "expo.out",
      clearProps: "transform,translate,scale,opacity",
    });
  }, { scope: containerRef, dependencies: [typeFilter, view] });

  const handleCopyUrl = (node: NodeItem) => {
    const url = buildNodeShareUrl(node);
    if (url) navigator.clipboard.writeText(url);
  };

  const handleSyncNode = async (node: NodeItem) => {
    try {
      // The server pushes the bumped node over the WebSocket
      await api("POST", `/api/nodes/${node.id}/sync`);
    } catch (e) {
      console.error("触发节点配置同步失败:", e);
    }
  };

  const counts: Record<string, number> = {
    all: nodes.length,
    direct: nodes.filter((n) => n.type === "direct").length,
    unlock: nodes.filter((n) => n.type === "unlock").length,
    probe: nodes.filter((n) => n.type === "probe").length,
    circuit_broken: nodes.filter((n) => n.status === "circuit_broken").length,
  };

  const filters = [
    { id: "all", label: "全部" },
    { id: "direct", label: "主力直连" },
    { id: "unlock", label: "解锁落地" },
    { id: "probe", label: "仅探针" },
    { id: "circuit_broken", label: "已熔断" },
  ];

  const cardProps = (node: NodeItem) => ({
    node,
    onOpen: onOpenNode,
    onViewConfig: setActiveConfigNode,
    onViewInstall: setActiveInstallNode,
    onEdit: setActiveEditNode,
    onResetTraffic,
    onDelete,
    onCopyUrl: handleCopyUrl,
    onViewVersion: () => setIsVersionModalOpen(true),
    onViewProbeVersion: () => setIsProbeVersionModalOpen(true),
    onSyncConfig: handleSyncNode,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 min-w-[240px] text-sm text-ink-secondary">
          {counts.all} 台 VPS · {counts.direct} 台主力直连 · {counts.unlock} 台解锁落地 · {counts.probe} 台仅探针
        </p>
        <Button variant="secondary" size="sm" onClick={() => setIsProbeVersionModalOpen(true)} icon={<Cpu className="w-3.5 h-3.5" />}>
          探针版本
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setIsVersionModalOpen(true)} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
          Xray 内核版本
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="节点类型" className="flex p-[3px] gap-0.5 rounded-[9px] border border-rule bg-paper-2 overflow-x-auto max-w-full">
          {filters.map((t) => {
            const active = typeFilter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTypeFilter(t.id)}
                className={`h-8 px-3 rounded-md text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  active ? "bg-paper-3 text-ink" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 font-mono text-xs ${t.id === "circuit_broken" && counts[t.id] > 0 ? "text-status-danger" : "text-ink-muted"}`}>
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-72">
            <Input
              prefixIcon={<MagnifyingGlass className="w-3.5 h-3.5" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名称、IP、地区或标签"
              aria-label="搜索节点"
            />
          </div>
          <div role="group" aria-label="视图" className="flex shrink-0 rounded-lg border border-rule overflow-hidden">
            {([
              { id: "grid", label: "卡片视图", icon: SquaresFour },
              { id: "table", label: "表格视图", icon: Rows },
            ] as const).map((v) => (
              <button
                key={v.id}
                type="button"
                aria-label={v.label}
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
                className={`w-9 h-9 flex items-center justify-center cursor-pointer transition-colors ${
                  view === v.id ? "bg-paper-3 text-ink" : "bg-paper-2 text-ink-muted hover:text-ink"
                }`}
              >
                <v.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div ref={containerRef} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-3">
          {filteredNodes.map((node) => (
            <div key={node.id} className="node-card-wrap h-full flex flex-col">
              <NodeCard {...cardProps(node)} />
            </div>
          ))}
        </div>
      ) : (
        filteredNodes.length > 0 && <NodeTable nodes={filteredNodes} onOpen={onOpenNode} onEdit={setActiveEditNode} />
      )}

      {filteredNodes.length === 0 && (
        <div className="p-12 text-center rounded-lg border border-dashed border-rule text-ink-muted text-sm">
          没有符合条件的节点
        </div>
      )}

      {/* Modals */}
      <ConfigModal
        node={activeConfigNode}
        onClose={() => setActiveConfigNode(null)}
      />
      <InstallModal
        node={activeInstallNode}
        onClose={() => setActiveInstallNode(null)}
      />
      <NodeForm
        node={activeEditNode}
        isOpen={!!activeEditNode}
        onClose={() => setActiveEditNode(null)}
        onSubmit={(input) => onUpdate(activeEditNode!.id, input)}
      />
      <XrayVersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        nodes={nodes}
        onRefreshData={onRefreshData}
      />
      <ProbeVersionModal
        isOpen={isProbeVersionModalOpen}
        onClose={() => setIsProbeVersionModalOpen(false)}
        nodes={nodes}
        onRefreshData={onRefreshData}
      />
    </div>
  );
};
