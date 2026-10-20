import { db } from "../db/index.js";
import { historyStore } from "./historyStore.js";
import type { TrafficAnalyticsSummary, TrafficRange } from "../types/index.js";

export const TRAFFIC_RANGES: readonly TrafficRange[] = ["today", "7d", "30d", "month", "all"];

/** Start of the local hour ("today") or local day (longer ranges) containing `timestamp`. */
function bucketStart(timestamp: number, hourly: boolean): number {
  const d = new Date(timestamp);
  return hourly ? d.setMinutes(0, 0, 0) : d.setHours(0, 0, 0, 0);
}

/** Traffic measured on each node's network interface (probe byte counters), per node and over time. */
export function getTrafficAnalytics(timeRange: TrafficRange = "today"): TrafficAnalyticsSummary {
  const rows = historyStore.samples(timeRange);
  let totalUplinkBytes = 0, totalDownlinkBytes = 0;
  const perNode = new Map<string, number>();
  const buckets = new Map<number, number>();
  for (const row of rows) {
    totalUplinkBytes += row.tx;
    totalDownlinkBytes += row.rx;
    const bytes = row.tx + row.rx;
    perNode.set(row.nodeId, (perNode.get(row.nodeId) || 0) + bytes);
    const timestamp = bucketStart(row.timestamp, timeRange === "today");
    buckets.set(timestamp, (buckets.get(timestamp) || 0) + bytes);
  }
  const totalRecordedBytes = totalUplinkBytes + totalDownlinkBytes;
  const nodeDistributions = [...perNode].map(([nodeId, totalBytes]) => {
    const node = db.getNodeById(nodeId);
    return {
      nodeId,
      nodeName: node?.name || "已删除节点",
      country: node?.country || "",
      countryName: node?.countryName || "",
      totalBytes,
      percentage: totalRecordedBytes ? (totalBytes / totalRecordedBytes) * 100 : 0,
    };
  });
  return {
    timeRange,
    totalRecordedBytes,
    totalUplinkBytes,
    totalDownlinkBytes,
    nodeDistributions,
    timeSeries: [...buckets].map(([timestamp, totalBytes]) => ({ timestamp, totalBytes })).sort((a, b) => a.timestamp - b.timestamp),
    updatedAt: Date.now(),
  };
}
