import { db } from "../db/index.js";
import { historyStore } from "./historyStore.js";
import type { TrafficAnalyticsSummary, TrafficTimeSeriesPoint } from "../types/index.js";

export class TrafficService {
  public getTrafficAnalytics(timeRange: TrafficAnalyticsSummary["timeRange"] = "today"): TrafficAnalyticsSummary {
    const rows = historyStore.samples(timeRange);
    const totalUplinkBytes = rows.reduce((sum, p) => sum + p.tx, 0);
    const totalDownlinkBytes = rows.reduce((sum, p) => sum + p.rx, 0);
    const totalRecordedBytes = totalUplinkBytes + totalDownlinkBytes;
    const perNode = new Map<string, number>();
    const buckets = new Map<number, TrafficTimeSeriesPoint>();
    const width = timeRange === "today" ? 3600000 : 86400000;
    for (const row of rows) {
      const bytes = row.tx + row.rx;
      perNode.set(row.nodeId, (perNode.get(row.nodeId) || 0) + bytes);
      const timestamp = Math.floor(row.timestamp / width) * width;
      const bucket = buckets.get(timestamp) || { timestamp, time: new Date(timestamp).toLocaleString("zh-CN", timeRange === "today" ? { hour: "2-digit", minute: "2-digit" } : { month: "2-digit", day: "2-digit" }), totalBytes: 0, streamingBytes: 0, aiBytes: 0, socialBytes: 0, devBytes: 0, otherBytes: 0 };
      bucket.totalBytes += bytes; bucket.otherBytes += bytes; buckets.set(timestamp, bucket);
    }
    const nodeDistributions = [...perNode].map(([nodeId, totalBytes]) => {
      const node = db.getNodeById(nodeId);
      return { nodeId, nodeName: node?.name || "已删除节点", country: node?.country || "", countryName: node?.countryName || "", totalBytes, percentage: totalRecordedBytes ? totalBytes / totalRecordedBytes * 100 : 0, topServices: [] };
    });
    return {
      timeRange, totalRecordedBytes, totalUplinkBytes, totalDownlinkBytes,
      totalRequests: 0, activeStreams: 0, services: [],
      categories: totalRecordedBytes ? [{ category: "other", categoryName: "未分类（网卡实测）", color: "#64748b", totalBytes: totalRecordedBytes, percentage: 100, servicesCount: 0 }] : [],
      nodeDistributions, timeSeries: [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp), updatedAt: Date.now(),
    };
  }
}
export const trafficService = new TrafficService();
