import { db } from "../db/index.js";
import { historyStore, rangeStart } from "./historyStore.js";
import type { TrafficAnalyticsSummary, TrafficRange } from "../types/index.js";

export const TRAFFIC_RANGES: readonly TrafficRange[] = ["today", "7d", "30d", "month", "all"];

/** Start of the local hour ("today") or local day (longer ranges) containing `timestamp`. */
function bucketStart(timestamp: number, hourly: boolean): number {
  const d = new Date(timestamp);
  return hourly ? d.setMinutes(0, 0, 0) : d.setHours(0, 0, 0, 0);
}

/** Every bucket from `start` through `now`, so hours or days without traffic show up as zero instead of vanishing. */
function emptyBuckets(start: number, now: number, hourly: boolean): Map<number, number> {
  const buckets = new Map<number, number>();
  const d = new Date(bucketStart(start, hourly));
  while (d.getTime() <= now) {
    buckets.set(d.getTime(), 0);
    if (hourly) d.setHours(d.getHours() + 1); else d.setDate(d.getDate() + 1);
  }
  return buckets;
}

/** Traffic measured on each node's network interface (probe byte counters), per node and over time. */
export function getTrafficAnalytics(timeRange: TrafficRange = "today"): TrafficAnalyticsSummary {
  const now = Date.now();
  const hourly = timeRange === "today";
  const rows = historyStore.samples(timeRange);
  let totalUplinkBytes = 0, totalDownlinkBytes = 0;
  const perNode = new Map<string, number>();
  // Rows are grouped per node, so the earliest sample is not necessarily first
  const start = timeRange === "all" ? rows.reduce((min, row) => Math.min(min, row.timestamp), now) : rangeStart(timeRange, now);
  const buckets = emptyBuckets(start, now, hourly);
  for (const row of rows) {
    totalUplinkBytes += row.tx;
    totalDownlinkBytes += row.rx;
    const bytes = row.tx + row.rx;
    perNode.set(row.nodeId, (perNode.get(row.nodeId) || 0) + bytes);
    const timestamp = bucketStart(row.timestamp, hourly);
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
      percentage: totalRecordedBytes ? Math.round((totalBytes / totalRecordedBytes) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.totalBytes - a.totalBytes);
  return {
    timeRange,
    totalRecordedBytes,
    totalUplinkBytes,
    totalDownlinkBytes,
    nodeDistributions,
    timeSeries: [...buckets].map(([timestamp, totalBytes]) => ({ timestamp, totalBytes })).sort((a, b) => a.timestamp - b.timestamp),
    updatedAt: now,
  };
}
