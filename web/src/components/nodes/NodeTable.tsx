import React from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { NodeItem } from "../../types";
import { formatSpeed, toGB, formatPct } from "../../utils/format";
import { STATUS_META, roleMeta, billingText } from "./NodeCard";

interface NodeTableProps {
  nodes: NodeItem[];
  onOpen?: (node: NodeItem) => void;
  onEdit: (node: NodeItem) => void;
}

const th = "px-3 h-10 text-left text-xs font-medium text-ink-muted whitespace-nowrap";
const td = "px-3 h-12 text-[13px] whitespace-nowrap";

/** Dense list view of nodes — one row per VPS */
export const NodeTable: React.FC<NodeTableProps> = ({ nodes, onOpen, onEdit }) => (
  <div className="relative rounded-xl border border-rule bg-paper-2 overflow-x-auto">
    <table className="w-full min-w-[920px] border-collapse">
      <thead>
        <tr className="border-b border-rule">
          <th className={th}>节点</th>
          <th className={th}>状态</th>
          <th className={th}>角色</th>
          <th className={`${th} text-right`}>下行 / 上行</th>
          <th className={`${th} text-right`}>延迟</th>
          <th className={`${th} text-right`}>CPU</th>
          <th className={`${th} text-right`}>内存</th>
          <th className={th}>本月流量</th>
          <th className={th}>账单</th>
          <th className={th}>
            <span className="sr-only">操作</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((n) => {
          const st = STATUS_META[n.status];
          const role = roleMeta(n);
          const bill = billingText(n);
          const pct = n.trafficLimitBytes > 0 ? Math.min(100, (n.trafficUsedBytes / n.trafficLimitBytes) * 100) : 0;
          const down = formatSpeed(n.downlinkSpeedBytes);
          const up = formatSpeed(n.uplinkSpeedBytes);
          return (
            <tr key={n.id} className="border-b border-rule-subtle last:border-0 hover:bg-paper-3/60 transition-colors">
              <td className={td}>
                <div className="flex items-center gap-2.5 max-w-[280px]">
                  <span className="w-[30px] h-[20px] rounded-[5px] bg-paper-3 text-ink-secondary font-mono text-[11px] flex items-center justify-center shrink-0">
                    {n.country || "--"}
                  </span>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpen?.(n)}
                      className="block max-w-full truncate font-medium text-ink hover:text-accent cursor-pointer text-left"
                      title={n.name}
                    >
                      {n.name}
                    </button>
                    <div className="font-mono text-[11px] text-ink-muted truncate">{n.ip}</div>
                  </div>
                </div>
              </td>
              <td className={td}>
                <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-xs font-medium ${st.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </td>
              <td className={td}>
                <span className={`inline-flex items-center h-[22px] px-2 rounded-md text-xs font-medium ${role.chip}`}>{role.label}</span>
              </td>
              <td className={`${td} text-right font-mono text-ink-secondary`}>
                {down.val.toFixed(1)} {down.unit} <span className="text-ink-muted">/</span> {up.val.toFixed(1)} {up.unit}
              </td>
              <td className={`${td} text-right font-mono text-ink-secondary`}>{n.latencyMs > 0 ? `${n.latencyMs} ms` : "—"}</td>
              <td className={`${td} text-right font-mono text-ink-secondary`}>{formatPct(n.cpuUsage)}%</td>
              <td className={`${td} text-right font-mono text-ink-secondary`}>{formatPct(n.memUsage)}%</td>
              <td className={td}>
                <div className="flex items-center gap-2 w-[150px]">
                  <div className="flex-1 h-1 rounded-sm bg-paper-3 overflow-hidden">
                    <div
                      className={`h-full ${pct >= 95 ? "bg-status-danger" : pct >= 80 ? "bg-status-warning" : "bg-accent"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-ink-muted w-[64px] text-right">{toGB(n.trafficUsedBytes)} GB</span>
                </div>
              </td>
              <td className={`${td} text-xs ${bill.days !== null && bill.days <= 7 ? "text-status-warning" : "text-ink-muted"}`}>
                {bill.text}
              </td>
              <td className={`${td} text-right`}>
                <button
                  type="button"
                  onClick={() => onEdit(n)}
                  aria-label={`编辑 ${n.name}`}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 cursor-pointer"
                >
                  <PencilSimple className="w-4 h-4" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
