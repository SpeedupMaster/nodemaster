import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteJson } from "./security.js";
import type { LatencyTask, NodeItem, NodeLatencyHistory } from "../types/index.js";

export interface Sample {
  nodeId: string; timestamp: number; cpu: number; mem: number; disk: number;
  up: number; down: number; tx: number; rx: number;
}
interface LatencySample { nodeId: string; taskId: string; timestamp: number; latencyMs: number; lossRate: number; jitter: number }
interface HistoryData { samples: Sample[]; latency: LatencySample[] }
const DAY = 86400000;
const dataDir = process.env.NODEMASTER_DATA_DIR || fileURLToPath(new URL("../../data/", import.meta.url));

export function rangeStart(range: string, now = Date.now()): number {
  const durations: Record<string, number> = { "1h": 3600000, "6h": 21600000, "12h": 43200000, "1d": DAY, "3d": 3 * DAY, "7d": 7 * DAY, "30d": 30 * DAY };
  if (range === "all") return 0;
  if (range === "today") return new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  if (range === "month") return new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  return now - (durations[range] || durations["1h"]);
}

export class HistoryStore {
  private data: HistoryData = { samples: [], latency: [] };
  private timer?: NodeJS.Timeout;
  private dirty = false;
  constructor(private file = path.join(dataDir, "telemetry-history.json")) {
    if (fs.existsSync(file)) {
      const value = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(value.samples) || !Array.isArray(value.latency)) throw new Error("Invalid telemetry history; original file retained");
      this.data = value;
    }
  }
  private changed() {
    this.dirty = true;
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        try { this.flush(); } catch (error) { console.error("History flush failed", error); this.changed(); }
      }, 30000);
      this.timer.unref();
    }
  }
  public flush() {
    clearTimeout(this.timer); this.timer = undefined;
    if (!this.dirty) return;
    const cutoff = Date.now() - 35 * DAY;
    this.data.samples = this.data.samples.filter(p => p.timestamp >= cutoff);
    this.data.latency = this.data.latency.filter(p => p.timestamp >= cutoff);
    atomicWriteJson(this.file, this.data);
    this.dirty = false;
  }
  public record(node: NodeItem, tx: number, rx: number, now = Date.now()) {
    const timestamp = Math.floor(now / 60000) * 60000;
    const previous = this.data.samples.findLast(p => p.nodeId === node.id && p.timestamp === timestamp);
    const metrics = { cpu: node.cpuUsage, mem: node.memUsage, disk: node.diskUsage, up: node.uplinkSpeedBytes, down: node.downlinkSpeedBytes };
    if (previous) Object.assign(previous, metrics, { tx: previous.tx + tx, rx: previous.rx + rx });
    else this.data.samples.push({ nodeId: node.id, timestamp, ...metrics, tx, rx });
    this.changed();
  }
  public recordLatency(nodeId: string, values: LatencySample[], now = Date.now()) {
    for (const value of values) {
      const previous = this.data.latency.findLast(p => p.nodeId === nodeId && p.taskId === value.taskId);
      if (previous && now - previous.timestamp < 1000) continue;
      this.data.latency.push({ ...value, nodeId, timestamp: now });
    }
    if (values.length) this.changed();
  }
  public samples(range: string, nodeId?: string) {
    const start = Math.max(rangeStart(range), Date.now() - 35 * DAY);
    return this.data.samples.filter(p => p.timestamp >= start && (!nodeId || p.nodeId === nodeId));
  }
  public loadHistory(nodeId: string, range: string) {
    const samples = this.samples(range, nodeId);
    const stride = Math.max(1, Math.ceil(samples.length / 300));
    const rows = samples.filter((_, i) => i % stride === 0);
    return { timestamps: rows.map(p => p.timestamp), cpu: rows.map(p => p.cpu), mem: rows.map(p => p.mem), disk: rows.map(p => p.disk), netIn: rows.map(p => p.down), netOut: rows.map(p => p.up) };
  }
  public latencyHistory(nodeId: string, range: string, tasks: LatencyTask[]): NodeLatencyHistory[] {
    const start = rangeStart(range);
    return tasks.filter(t => t.enabled && (!t.nodeIds.length || t.nodeIds.includes(nodeId))).flatMap(task => {
      const points = this.data.latency.filter(p => p.nodeId === nodeId && p.taskId === task.id && p.timestamp >= start);
      if (!points.length) return [];
      const stride = Math.max(1, Math.ceil(points.length / 300));
      const latest = points[points.length - 1];
      return [{ nodeId, taskId: task.id, taskName: task.name, color: "#3b82f6", currentLatency: latest.latencyMs, lossRate: latest.lossRate, jitter: latest.jitter, history: points.filter((_, i) => i % stride === 0) }];
    });
  }
}
export const historyStore = new HistoryStore();
