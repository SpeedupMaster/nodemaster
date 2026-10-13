import { db } from "../db/index.js";
import { billingPeriod } from "./security.js";
import { historyStore } from "./historyStore.js";
import type { NodeItem } from "../types/index.js";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const integer = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v);
const OFFLINE_MS = 30000;

export function maintainNodes(now = Date.now()) {
  for (const node of db.getNodes()) {
    const updates: Partial<NodeItem> = {};
    const period = billingPeriod(now, node.trafficResetDay || db.getConfig().trafficResetDay || 1);
    if (!node.trafficPeriodStart) updates.trafficPeriodStart = period;
    else if (period > node.trafficPeriodStart) {
      updates.trafficPeriodStart = period;
      updates.trafficUsedBytes = 0;
      if (node.status === "circuit_broken") {
        updates.status = now - node.lastSeen > OFFLINE_MS ? "offline" : "online";
        updates.configVersion = Math.max(now, (node.configVersion || 0) + 1);
        updates.configSyncStatus = "pending";
      }
    }
    if (now - node.lastSeen > OFFLINE_MS) {
      if ((updates.status || node.status) !== "circuit_broken") updates.status = "offline";
      updates.uplinkSpeedBytes = 0;
      updates.downlinkSpeedBytes = 0;
    }
    if (Object.entries(updates).some(([key, value]) => value !== (node as any)[key])) db.updateNode(node.id, updates, true);
  }
}

export function ingestTelemetry(nodeId: string, data: Record<string, any>, now = Date.now()) {
  maintainNodes(now);
  const node = db.getNodeById(nodeId);
  if (!node) throw new Error("Node not found");
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid telemetry");
  const updates: Partial<NodeItem> = { lastSeen: now, status: node.status === "circuit_broken" ? "circuit_broken" : "online" };
  const countersValid = typeof data.bootId === "string" && data.bootId.length <= 100 && integer(data.sequence) && integer(data.networkRxBytes) && integer(data.networkTxBytes);
  const duplicate = countersValid && data.bootId === node.telemetryBootId && data.sequence <= (node.telemetrySequence ?? -1);
  if (duplicate) return db.getNodeById(nodeId)!;
  const numericKeys = ["cpuUsage", "memUsage", "diskUsage", "memTotalBytes", "memUsedBytes", "diskTotalBytes", "diskUsedBytes", "uplinkSpeedBytes", "downlinkSpeedBytes", "tcpCount", "udpCount"] as const;
  for (const key of numericKeys) {
    if (data[key] !== undefined && !finite(data[key])) throw new Error(`Invalid ${key}`);
    if (finite(data[key])) updates[key] = key.endsWith("Usage") ? Math.min(100, data[key]) : data[key];
  }
  if (Array.isArray(data.loadAvg) && data.loadAvg.length === 3 && data.loadAvg.every(finite)) updates.loadAvg = data.loadAvg as [number, number, number];
  for (const key of ["uptime", "os", "arch", "tcpCongestion"] as const) {
    if (typeof data[key] === "string") updates[key] = data[key].slice(0, 200);
  }
  let tx = 0, rx = 0;
  if (countersValid) {
    if (data.bootId === node.telemetryBootId && node.networkRxBytes !== undefined && node.networkTxBytes !== undefined) {
      tx = Math.max(0, data.networkTxBytes - node.networkTxBytes);
      rx = Math.max(0, data.networkRxBytes - node.networkRxBytes);
    }
    Object.assign(updates, { telemetryBootId: data.bootId, telemetrySequence: data.sequence, networkRxBytes: data.networkRxBytes, networkTxBytes: data.networkTxBytes });
    updates.trafficUsedBytes = node.trafficUsedBytes + tx + rx;
  }
  const config = db.getConfig();
  if (config.autoCircuitBreaker && node.trafficLimitBytes > 0 && (updates.trafficUsedBytes ?? node.trafficUsedBytes) >= node.trafficLimitBytes * config.circuitBreakerThresholdPct / 100) {
    updates.status = "circuit_broken";
    if (node.status !== "circuit_broken") {
      updates.configVersion = Math.max(now, (node.configVersion || 0) + 1);
      updates.configSyncStatus = "pending";
    }
  }
  const reported = integer(data.appliedConfigVersion) ? data.appliedConfigVersion : 0;
  const target = updates.configVersion || node.configVersion || 0;
  if (reported === target && target > 0) Object.assign(updates, { appliedConfigVersion: reported, configSyncStatus: "synced", configSyncedAt: now, configSyncError: undefined });
  if (data.syncReport?.status === "error") Object.assign(updates, { configSyncStatus: "failed", configSyncError: String(data.syncReport.error || "Reload failed").slice(0, 500) });
  if (typeof data.xrayVersion === "string" && /^v?\d+\.\d+\.\d+$/.test(data.xrayVersion)) {
    updates.xrayVersion = data.xrayVersion.startsWith("v") ? data.xrayVersion : `v${data.xrayVersion}`;
    if (node.desiredXrayVersion === updates.xrayVersion) Object.assign(updates, { upgradeStatus: "succeeded", upgradeError: undefined });
  }
  if (data.upgradeReport?.status === "error" && data.upgradeReport.version === node.desiredXrayVersion) Object.assign(updates, { upgradeStatus: "failed", upgradeError: String(data.upgradeReport.error || "Upgrade failed").slice(0, 500) });
  const updated = db.updateNode(node.id, updates, true)!;
  historyStore.record(updated, tx, rx, now);
  const tasks = db.getLatencyTasks().filter(t => t.enabled && (!t.nodeIds.length || t.nodeIds.includes(node.id)));
  if (Array.isArray(data.latencyResults)) {
    const valid = data.latencyResults.slice(0, 100).filter((r: any) => r && tasks.some(t => t.id === r.taskId) && finite(r.latencyMs) && finite(r.lossRate) && r.lossRate <= 100 && finite(r.jitter));
    historyStore.recordLatency(node.id, valid, now);
    const reachable = valid.filter((p: any) => p.lossRate === 0);
    if (reachable.length) db.updateNode(node.id, { latencyMs: Math.round(reachable.reduce((sum: number, p: any) => sum + p.latencyMs, 0) / reachable.length) }, true);
  }
  return updated;
}

export function agentDirectives(node: NodeItem) {
  return {
    proxyAction: node.status === "circuit_broken" ? "STOP" : "RUN",
    sync: (node.configVersion || 0) > (node.appliedConfigVersion || 0) ? { action: "RELOAD_CONFIG", targetVersion: node.configVersion, configUrl: `/api/nodes/by-token/${node.token}/xray-config` } : null,
    upgrade: node.desiredXrayVersion && node.desiredXrayVersion !== node.xrayVersion && node.upgradeStatus === "pending" ? { action: "XRAY_UPGRADE", version: node.desiredXrayVersion, scriptUrl: `/api/xray/upgrade.sh?version=${encodeURIComponent(node.desiredXrayVersion)}` } : null,
    latencyTasks: db.getLatencyTasks().filter(t => t.enabled && (!t.nodeIds.length || t.nodeIds.includes(node.id))),
  };
}
