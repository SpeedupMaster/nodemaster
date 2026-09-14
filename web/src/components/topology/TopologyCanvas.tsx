import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
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
  const [transitId, setTransitId] = useState("");
  const [exitId, setExitId] = useState("");
  const [port, setPort] = useState("10443");
  const [submitting, setSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const streamLinesRef = useRef<SVGSVGElement>(null);

  const transitNodes = nodes.filter((n) => n.type === "transit");
  const exitNodes = nodes.filter((n) => n.type === "exit");

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

  const handleCreateRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitId || !exitId) return;

    setSubmitting(true);
    try {
      await onAddRelay({
        name: name || "链路中继",
        transitNodeId: transitId,
        exitNodeId: exitId,
        transitPort: Number(port) || 10443,
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
      <div className="flex items-center justify-between bg-paper-2 p-4 rounded-lg border border-rule">
        <div>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <ShareNetwork weight="bold" className="w-4 h-4 text-accent" />
            中转分流拓扑与链式网络
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            国内前置机监听端口并通过 Dokodemo-door 转发至海外落地机 VLESS Reality 端口，实现双向精准测速与流量统计
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (transitNodes.length > 0) setTransitId(transitNodes[0].id);
            if (exitNodes.length > 0) setExitId(exitNodes[0].id);
            setIsAddModalOpen(true);
          }}
          icon={<Plus weight="bold" className="w-3.5 h-3.5" />}
        >
          创建中转链路
        </Button>
      </div>

      {/* Topology Stage */}
      <div className="relative bg-paper-2/80 rounded-xl border border-rule p-8 min-h-[460px] flex flex-col justify-between overflow-hidden">
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

        {/* Column Labels */}
        <div className="grid grid-cols-2 gap-8 text-xs font-mono uppercase tracking-wider text-ink-muted border-b border-rule pb-3 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>前置中转入口节点 (国内/BGP)</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>海外目标落地节点 (Reality)</span>
          </div>
        </div>

        {/* Links Display & Topology Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 my-6 z-10">
          {/* Left Column: Transit Nodes */}
          <div className="space-y-4">
            {transitNodes.map((tn) => (
              <div
                key={tn.id}
                className="p-4 rounded-lg bg-paper border border-sky-500/30 shadow-md relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink font-mono">
                      {tn.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/50 text-sky-300 border border-sky-500/20 font-mono">
                      {tn.countryName}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    在线
                  </span>
                </div>
                <div className="text-xs font-mono text-ink-muted mt-1.5">
                  入口 IP: {tn.ip} • Dokodemo-door
                </div>
              </div>
            ))}
            {transitNodes.length === 0 && (
              <div className="p-6 text-center text-xs text-ink-muted border border-dashed border-rule rounded-lg">
                暂无前置中转节点，请在节点管理中添加类型为“中转入口”的 VPS
              </div>
            )}
          </div>

          {/* Right Column: Exit Nodes */}
          <div className="space-y-4">
            {exitNodes.map((en) => (
              <div
                key={en.id}
                className="p-4 rounded-lg bg-paper border border-purple-500/30 shadow-md relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink font-mono">
                      {en.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/50 text-purple-300 border border-purple-500/20 font-mono">
                      {en.countryName}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-accent">
                    {en.latencyMs} ms
                  </span>
                </div>
                <div className="text-xs font-mono text-ink-muted mt-1.5">
                  落地 IP: {en.ip}:{en.port} • VLESS-Reality
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Relay Links Table */}
        <div className="border-t border-rule pt-4 z-10">
          <div className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-3 flex items-center gap-2">
            <Lightning className="w-3.5 h-3.5 text-accent" />
            当前活跃专线链路 ({relays.length})
          </div>

          <div className="space-y-2">
            {relays.map((r) => {
              const transit = nodes.find((n) => n.id === r.transitNodeId);
              const exit = nodes.find((n) => n.id === r.exitNodeId);
              const usedGB = (r.trafficBytes / (1024 * 1024 * 1024)).toFixed(1);

              return (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-paper border border-rule gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                      <ArrowsLeftRight className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-ink">{r.name}</div>
                      <div className="text-[11px] font-mono text-ink-muted flex items-center gap-2 mt-0.5">
                        <span className="text-sky-400">{transit?.name || "未知入口"}</span>
                        <span>:(端口 {r.transitPort})</span>
                        <span>➔</span>
                        <span className="text-purple-400">{exit?.name || "未知落地"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-ink-muted">链路延迟: </span>
                      <span className="text-emerald-400 font-semibold">{r.latencyMs} ms</span>
                    </div>

                    <button
                      onClick={() => onDeleteRelay(r.id)}
                      className="p-1.5 rounded text-ink-muted hover:text-status-danger hover:bg-status-danger-bg transition-colors"
                      title="删除该中转链路"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {relays.length === 0 && (
              <div className="text-center py-6 text-xs text-ink-muted">
                暂无配置的中转链路。点击右上角“创建中转链路”即可将入口机与落地机绑定。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Relay Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="组装新的中转链路"
        subtitle="将前置优化入口机与海外落地机进行端口与链式绑定"
        maxWidth="md"
      >
        <form onSubmit={handleCreateRelay} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              链路名称 *
            </label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 广港BGP专线01"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              前置中转机 (入口节点) *
            </label>
            <Select
              options={transitNodes.map((n) => ({
                value: n.id,
                label: `${n.name} (${n.ip})`,
                badge: n.countryName,
              }))}
              value={transitId}
              onChange={(val) => setTransitId(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              前置机中转转发端口 *
            </label>
            <Input
              type="number"
              required
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="10443"
              suffixText="端口"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              目标落地机 (海外出口节点) *
            </label>
            <Select
              options={exitNodes.map((n) => ({
                value: n.id,
                label: `${n.name} (${n.ip}:${n.port})`,
                badge: n.countryName,
              }))}
              value={exitId}
              onChange={(val) => setExitId(val)}
            />
          </div>

          <div className="pt-4 border-t border-rule flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              保存并下发中转规则
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
