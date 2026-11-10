import React, { useEffect, useMemo, useState } from "react";
import { LatencyTask, NodeItem, NodeLatencyHistory } from "../../types";
import { api } from "../../services/api";

interface LatencyMatrixProps {
  nodes: NodeItem[];
  tasks: LatencyTask[];
  onOpenNodeDetail: (node: NodeItem) => void;
}

type Cell = { avg: number; loss: number; jitter: number; samples: number };

const REFRESH_MS = 60_000;

/** Quality tiers shared by the legend and the cells */
const TIERS = [
  { label: "< 60 ms", cell: "bg-status-online-bg text-status-online" },
  { label: "60–150", cell: "bg-accent-subtle text-accent" },
  { label: "150–200", cell: "bg-status-warning-bg text-status-warning" },
  { label: "> 200 或丢包", cell: "bg-status-danger-bg text-status-danger" },
];

const tierOf = (c: Cell) => {
  if (c.loss >= 5 || c.avg > 200) return TIERS[3];
  if (c.avg >= 150) return TIERS[2];
  if (c.avg >= 60) return TIERS[1];
  return TIERS[0];
};

const summarize = (h: NodeLatencyHistory): Cell | null => {
  const pts = h.history.filter((p) => p.latencyMs > 0);
  if (pts.length === 0) {
    if (h.currentLatency > 0) return { avg: h.currentLatency, loss: h.lossRate, jitter: h.jitter, samples: 1 };
    return h.history.length > 0 ? { avg: 0, loss: 100, jitter: 0, samples: h.history.length } : null;
  }
  const avg = pts.reduce((s, p) => s + p.latencyMs, 0) / pts.length;
  const loss = h.history.reduce((s, p) => s + p.lossRate, 0) / h.history.length;
  const jitter = pts.reduce((s, p) => s + p.jitter, 0) / pts.length;
  return { avg, loss, jitter, samples: h.history.length };
};

const fmtMs = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));

/** Node × target heatmap of last-hour average RTT */
export const LatencyMatrix: React.FC<LatencyMatrixProps> = ({ nodes, tasks, onOpenNodeDetail }) => {
  const [grid, setGrid] = useState<Record<string, Record<string, Cell>>>({});
  const [loading, setLoading] = useState(true);

  const monitored = nodes;
  const columns = useMemo(() => tasks.filter((t) => t.enabled), [tasks]);
  const nodeKey = monitored.map((n) => n.id).join(",");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const results = await Promise.allSettled(
        monitored.map((n) =>
          api<NodeLatencyHistory[]>("GET", `/api/ping/node-history/${n.id}?range=1h`, undefined, controller.signal).then(
            (rows) => [n.id, rows] as const
          )
        )
      );
      if (controller.signal.aborted) return;
      const next: Record<string, Record<string, Cell>> = {};
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const [nodeId, rows] = r.value;
        next[nodeId] = {};
        for (const row of rows) {
          const c = summarize(row);
          if (c) next[nodeId][row.taskId] = c;
        }
      }
      setGrid(next);
      setLoading(false);
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey]);

  const highlights = useMemo(() => {
    type Hit = { node: NodeItem; task: LatencyTask; c: Cell };
    let best = null as Hit | null;
    let worst = null as Hit | null;
    let lossy = 0;
    for (const node of monitored) {
      for (const task of columns) {
        const c = grid[node.id]?.[task.id];
        if (!c || c.avg <= 0) continue;
        if (!best || c.avg < best.c.avg) best = { node, task, c };
        if (!worst || c.avg > worst.c.avg) worst = { node, task, c };
        if (c.loss >= 1) lossy++;
      }
    }
    return { best, worst, lossy };
  }, [grid, monitored, columns]);

  if (columns.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-dashed border-rule text-sm text-ink-muted">
        还没有启用的监测任务。新建任务或恢复默认三网测速点后，这里会显示质量矩阵。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="p-4 sm:p-5 rounded-xl bg-paper-2 border border-rule space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-[15px] font-semibold text-ink">质量矩阵</h2>
          <span className="text-xs text-ink-muted">过去 1 小时平均 RTT，颜色表示质量等级</span>
          <div className="ml-auto flex flex-wrap gap-3.5 text-xs text-ink-secondary">
            {TIERS.map((t) => (
              <span key={t.label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-[3px] ${t.cell.split(" ")[0]}`} />
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full border-separate border-spacing-1" style={{ minWidth: 220 + columns.length * 96 }}>
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-ink-muted pr-2 pb-1 whitespace-nowrap">节点 \ 测速点</th>
                {columns.map((t) => (
                  <th key={t.id} className="text-xs font-medium text-ink-secondary pb-1 whitespace-nowrap px-1" title={t.target}>
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monitored.map((node) => (
                <tr key={node.id}>
                  <td className="pr-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpenNodeDetail(node)}
                      className="flex items-center gap-2 text-[13px] text-ink hover:text-accent cursor-pointer max-w-[240px]"
                    >
                      <span className="font-mono text-[11px] text-ink-muted w-[22px] shrink-0 text-left">{node.country}</span>
                      <span className="truncate">{node.name}</span>
                    </button>
                  </td>
                  {columns.map((task) => {
                    const assigned = task.nodeIds.length === 0 || task.nodeIds.includes(node.id);
                    const c = grid[node.id]?.[task.id];
                    if (!assigned) {
                      return (
                        <td key={task.id} className="h-10 rounded-md text-center text-xs text-ink-muted bg-paper" title="该任务未分配到此节点">
                          ·
                        </td>
                      );
                    }
                    if (!c) {
                      return (
                        <td key={task.id} className="h-10 rounded-md text-center font-mono text-xs text-ink-muted bg-paper-3">
                          {loading ? "…" : "—"}
                        </td>
                      );
                    }
                    const tier = tierOf(c);
                    return (
                      <td
                        key={task.id}
                        className={`h-10 rounded-md text-center font-mono text-[12.5px] ${tier.cell}`}
                        title={`${node.name} → ${task.name}\n平均 ${fmtMs(c.avg)} ms · 丢包 ${c.loss.toFixed(1)}% · 抖动 ±${c.jitter.toFixed(1)} ms · ${c.samples} 个样本`}
                      >
                        {c.avg > 0 ? fmtMs(c.avg) : "超时"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 sm:p-[18px] rounded-xl bg-paper-2 border border-rule flex flex-col gap-1.5 min-w-0">
          <span className="text-[13px] text-ink-secondary">最佳回程</span>
          <span className="text-[15px] font-semibold text-ink truncate">
            {highlights.best ? `${highlights.best.node.name} → ${highlights.best.task.name}` : "—"}
          </span>
          {highlights.best && (
            <span className="font-mono text-[13px] text-status-online">
              {fmtMs(highlights.best.c.avg)} ms · 丢包 {highlights.best.c.loss.toFixed(1)}% · ±{highlights.best.c.jitter.toFixed(1)} ms
            </span>
          )}
        </div>
        <div className="p-4 sm:p-[18px] rounded-xl bg-paper-2 border border-rule flex flex-col gap-1.5 min-w-0">
          <span className="text-[13px] text-ink-secondary">最差回程</span>
          <span className="text-[15px] font-semibold text-ink truncate">
            {highlights.worst ? `${highlights.worst.node.name} → ${highlights.worst.task.name}` : "—"}
          </span>
          {highlights.worst && (
            <span className={`font-mono text-[13px] ${tierOf(highlights.worst.c).cell.split(" ")[1]}`}>
              {fmtMs(highlights.worst.c.avg)} ms · 丢包 {highlights.worst.c.loss.toFixed(1)}% · ±{highlights.worst.c.jitter.toFixed(1)} ms
            </span>
          )}
        </div>
        <div className="p-4 sm:p-[18px] rounded-xl bg-paper-2 border border-rule flex flex-col gap-1.5 min-w-0">
          <span className="text-[13px] text-ink-secondary">过去 1 小时出现丢包</span>
          <span className="text-[15px] font-semibold text-ink">{highlights.lossy} 条线路</span>
          <span className="text-[13px] text-ink-muted">平均丢包率 ≥ 1% 的节点 → 测速点组合</span>
        </div>
      </div>
    </div>
  );
};
