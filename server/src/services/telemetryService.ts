import { db, bumpConfigVersion } from "../db/index.js";
import { billingPeriod } from "./security.js";
import { historyStore } from "./historyStore.js";
import { OFFLINE_AFTER_MS, isXrayVersion } from "../constants.js";
import type { NodeItem } from "../types/index.js";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const integer = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v);

export function formatUptime(uptime: string | number | undefined): string {
  if (!uptime && uptime !== 0) return "";
  let totalSec = typeof uptime === "number" ? uptime : NaN;
  if (typeof uptime === "string") {
    if (/^\d+(\.\d+)?\s*秒?$/.test(uptime.trim())) {
      totalSec = parseFloat(uptime);
    } else {
      return uptime.slice(0, 200);
    }
  }
  if (!Number.isFinite(totalSec) || totalSec < 0) return typeof uptime === "string" ? uptime.slice(0, 200) : "";

  const sec = Math.floor(totalSec);
  const MINUTE = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  if (sec >= YEAR) {
    const y = Math.floor(sec / YEAR);
    const m = Math.floor((sec % YEAR) / MONTH);
    return m > 0 ? `${y}年 ${m}月` : `${y}年`;
  }
  if (sec >= MONTH) {
    const m = Math.floor(sec / MONTH);
    const d = Math.floor((sec % MONTH) / DAY);
    return d > 0 ? `${m}月 ${d}天` : `${m}月`;
  }
  if (sec >= DAY) {
    const d = Math.floor(sec / DAY);
    const h = Math.floor((sec % DAY) / HOUR);
    return h > 0 ? `${d}天 ${h}小时` : `${d}天`;
  }
  if (sec >= HOUR) {
    const h = Math.floor(sec / HOUR);
    const m = Math.floor((sec % HOUR) / MINUTE);
    return m > 0 ? `${h}小时 ${m}分` : `${h}小时`;
  }
  if (sec >= MINUTE) {
    const m = Math.floor(sec / MINUTE);
    const s = sec % MINUTE;
    return s > 0 ? `${m}分 ${s}秒` : `${m}分`;
  }
  return `${Math.max(1, sec)}秒`;
}

export function maintainNodes(now = Date.now()) {
  for (const node of db.getNodes()) maintainNode(node, now);
}

function maintainNode(node: NodeItem, now: number) {
  const updates: Partial<NodeItem> = {};
  const period = billingPeriod(now, node.trafficResetDay || db.getConfig().trafficResetDay || 1);
  if (!node.trafficPeriodStart) updates.trafficPeriodStart = period;
  else if (period > node.trafficPeriodStart) {
    updates.trafficPeriodStart = period;
    updates.trafficUsedBytes = 0;
    if (node.status === "circuit_broken") {
      updates.status = now - node.lastSeen > OFFLINE_AFTER_MS ? "offline" : "online";
      Object.assign(updates, bumpConfigVersion(node, now));
    }
  }
  if (now - node.lastSeen > OFFLINE_AFTER_MS) {
    if ((updates.status || node.status) !== "circuit_broken") updates.status = "offline";
    updates.uplinkSpeedBytes = 0;
    updates.downlinkSpeedBytes = 0;
  }
  if (Object.entries(updates).some(([key, value]) => value !== (node as any)[key])) db.updateNode(node.id, updates, true);
}

export function ingestTelemetry(nodeId: string, data: Record<string, any>, now = Date.now()) {
  const current = db.getNodeById(nodeId);
  if (!current) throw new Error("Node not found");
  // Only this node needs a billing-period rollover check before counting new traffic;
  // the 3s heartbeat maintains all other nodes.
  maintainNode(current, now);
  const node = db.getNodeById(nodeId)!;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid telemetry");
  const updates: Partial<NodeItem> = { lastSeen: now, status: node.status === "circuit_broken" ? "circuit_broken" : "online" };
  const countersValid = typeof data.bootId === "string" && data.bootId.length <= 100 && integer(data.sequence) && integer(data.networkRxBytes) && integer(data.networkTxBytes);
  const duplicate = countersValid && data.bootId === node.telemetryBootId && data.sequence <= (node.telemetrySequence ?? -1);
  if (duplicate) return db.getNodeById(nodeId)!;
  const numericKeys = ["cpuUsage", "memUsage", "diskUsage", "memTotalBytes", "memUsedBytes", "diskTotalBytes", "diskUsedBytes", "uplinkSpeedBytes", "downlinkSpeedBytes", "tcpCount", "udpCount"] as const;
  for (const key of numericKeys) {
    if (data[key] !== undefined && !finite(data[key])) throw new Error(`Invalid ${key}`);
    if (finite(data[key])) updates[key] = key.endsWith("Usage") ? Math.round(Math.min(100, data[key]) * 100) / 100 : data[key];
  }
  if (Array.isArray(data.loadAvg) && data.loadAvg.length === 3 && data.loadAvg.every(finite)) updates.loadAvg = data.loadAvg.map((v: number) => Math.round(v * 100) / 100) as [number, number, number];
  if (data.uptime !== undefined) {
    updates.uptime = formatUptime(data.uptime);
  }
  for (const key of ["os", "arch", "tcpCongestion"] as const) {
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
    if (node.status !== "circuit_broken") Object.assign(updates, bumpConfigVersion(node, now));
  }
  const reported = integer(data.appliedConfigVersion) ? data.appliedConfigVersion : 0;
  const target = updates.configVersion || node.configVersion || 0;
  if (reported === target && target > 0) Object.assign(updates, { appliedConfigVersion: reported, configSyncStatus: "synced", configSyncedAt: now, configSyncError: undefined });
  if (data.syncReport?.status === "error") Object.assign(updates, { configSyncStatus: "failed", configSyncError: String(data.syncReport.error || "Reload failed").slice(0, 500) });
  if (isXrayVersion(data.xrayVersion)) {
    updates.xrayVersion = data.xrayVersion.startsWith("v") ? data.xrayVersion : `v${data.xrayVersion}`;
    if (node.desiredXrayVersion === updates.xrayVersion) Object.assign(updates, { upgradeStatus: "succeeded", upgradeError: undefined });
  }
  if (data.upgradeReport?.status === "error" && data.upgradeReport.version === node.desiredXrayVersion) Object.assign(updates, { upgradeStatus: "failed", upgradeError: String(data.upgradeReport.error || "Upgrade failed").slice(0, 500) });
  if (typeof data.probeVersion === "string" && data.probeVersion.trim()) {
    const pVer = data.probeVersion.trim();
    updates.probeVersion = pVer.startsWith("v") ? pVer : `v${pVer}`;
    if (node.desiredProbeVersion === updates.probeVersion) {
      Object.assign(updates, { probeUpgradeStatus: "succeeded", probeUpgradeError: undefined });
    }
  }
  if (data.probeUpgradeReport?.status === "error" && data.probeUpgradeReport.version === node.desiredProbeVersion) {
    Object.assign(updates, { probeUpgradeStatus: "failed", probeUpgradeError: String(data.probeUpgradeReport.error || "Probe upgrade failed").slice(0, 500) });
  }
  const updated = db.updateNode(node.id, updates, true)!;
  historyStore.record(updated, tx, rx, now);
  const tasks = db.getLatencyTasksFor(node.id);
  if (Array.isArray(data.latencyResults)) {
    const valid = data.latencyResults.slice(0, 100).filter((r: any) => r && tasks.some(t => t.id === r.taskId) && finite(r.latencyMs) && finite(r.lossRate) && r.lossRate <= 100 && finite(r.jitter));
    historyStore.recordLatency(node.id, valid, now);
    const reachable = valid.filter((p: any) => p.lossRate < 100 && p.latencyMs > 0);
    if (reachable.length) db.updateNode(node.id, { latencyMs: Math.round(reachable.reduce((sum: number, p: any) => sum + p.latencyMs, 0) / reachable.length) }, true);
  }
  return updated;
}

export function agentDirectives(node: NodeItem) {
  return {
    proxyAction: node.status === "circuit_broken" ? "STOP" : "RUN",
    sync: (node.configVersion || 0) > (node.appliedConfigVersion || 0) ? { action: "RELOAD_CONFIG", targetVersion: node.configVersion, configUrl: `/api/nodes/by-token/${node.token}/xray-config` } : null,
    upgrade: node.desiredXrayVersion && node.desiredXrayVersion !== node.xrayVersion && node.upgradeStatus === "pending" ? { action: "XRAY_UPGRADE", version: node.desiredXrayVersion, scriptUrl: `/api/xray/upgrade.sh?version=${encodeURIComponent(node.desiredXrayVersion)}` } : null,
    probeUpgrade: node.desiredProbeVersion && node.desiredProbeVersion !== node.probeVersion && node.probeUpgradeStatus === "pending" ? { action: "PROBE_UPGRADE", version: node.desiredProbeVersion, scriptUrl: `/api/probe/upgrade.sh?version=${encodeURIComponent(node.desiredProbeVersion)}` } : null,
    latencyTasks: db.getLatencyTasksFor(node.id),
  };
}
