import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { NodeItem } from "../../types";
import { NodeCard } from "./NodeCard";
import { ConfigModal } from "./ConfigModal";
import { InstallModal } from "./InstallModal";
import { EditNodeModal } from "./EditNodeModal";
import { XrayVersionModal } from "./XrayVersionModal";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react";

gsap.registerPlugin(useGSAP);

interface NodeListProps {
  nodes: NodeItem[];
  onResetTraffic: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<NodeItem>) => Promise<any> | any;
  onRefreshData?: () => void;
}

export const NodeList: React.FC<NodeListProps> = ({
  nodes,
  onResetTraffic,
  onDelete,
  onUpdate,
  onRefreshData,
}) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeConfigNode, setActiveConfigNode] = useState<NodeItem | null>(null);
  const [activeInstallNode, setActiveInstallNode] = useState<NodeItem | null>(null);
  const [activeEditNode, setActiveEditNode] = useState<NodeItem | null>(null);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredNodes = nodes.filter((node) => {
    const matchSearch =
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.ip.includes(search) ||
      node.countryName.toLowerCase().includes(search.toLowerCase()) ||
      node.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;
    if (typeFilter === "all") return true;
    if (typeFilter === "direct") return node.type === "direct" || node.type === "exit";
    if (typeFilter === "unlock") return node.type === "unlock";
    if (typeFilter === "circuit_broken") return node.status === "circuit_broken";
    return true;
  });

  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.from(".node-card-wrap", {
      opacity: 0,
      y: 16,
      stagger: 0.05,
      duration: 0.35,
      ease: "power2.out",
    });
  }, { scope: containerRef, dependencies: [typeFilter] });

  const handleCopyUrl = (node: NodeItem) => {
    if (node.protocol === "shadowsocks" && node.shadowsocks) {
      const auth = btoa(`${node.shadowsocks.method}:${node.shadowsocks.password}`);
      const url = `ss://${auth}@${node.ip}:${node.port}#${encodeURIComponent(node.name)}`;
      navigator.clipboard.writeText(url);
      return;
    }

    if (!node.reality) return;
    const r = node.reality;
    const url = `vless://${r.uuid}@${node.ip}:${node.port}?type=tcp&security=reality&pbk=${r.publicKey}&fp=${r.fingerprint}&sni=${r.serverName}&sid=${r.shortId}&spx=%2F&flow=${r.flow}#${encodeURIComponent(node.name)}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-paper-2 p-3 rounded-lg border border-rule">
        <div className="flex items-center gap-1 bg-paper p-1 rounded-md border border-rule w-full sm:w-auto">
          {[
            { id: "all", label: "全部节点" },
            { id: "direct", label: "主力直连" },
            { id: "unlock", label: "专属解锁" },
            { id: "circuit_broken", label: "超额熔断" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                typeFilter === t.id
                  ? "bg-paper-2 text-ink shadow-sm border border-rule"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsVersionModalOpen(true)}
            icon={<ShieldCheck className="w-3.5 h-3.5 text-purple-400" />}
            className="shrink-0"
          >
            Xray 内核版本管理
          </Button>

          <div className="w-full sm:w-64">
            <Input
              prefixIcon={<MagnifyingGlass className="w-3.5 h-3.5" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索节点名称、IP 或标签..."
            />
          </div>
        </div>
      </div>

      {/* Nodes Grid */}
      <div
        ref={containerRef}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredNodes.map((node) => (
          <div key={node.id} className="node-card-wrap h-full flex flex-col">
            <NodeCard
              node={node}
              onViewConfig={setActiveConfigNode}
              onViewInstall={setActiveInstallNode}
              onEdit={setActiveEditNode}
              onResetTraffic={onResetTraffic}
              onDelete={onDelete}
              onCopyUrl={handleCopyUrl}
              onViewVersion={() => setIsVersionModalOpen(true)}
            />
          </div>
        ))}
      </div>

      {filteredNodes.length === 0 && (
        <div className="p-12 text-center rounded-lg border border-dashed border-rule text-ink-muted text-sm">
          暂无符合条件的节点
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
      <EditNodeModal
        node={activeEditNode}
        isOpen={!!activeEditNode}
        onClose={() => setActiveEditNode(null)}
        onSubmit={onUpdate}
      />
      <XrayVersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        nodes={nodes}
        onRefreshData={onRefreshData}
      />
    </div>
  );
};
