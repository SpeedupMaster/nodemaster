import fs from "node:fs";
import path from "node:path";
import { atomicWriteJson } from "./security.js";
import { DATA_DIR } from "../paths.js";
import type { LatencyTask, NodeItem, NodeLatencyHistory } from "../types/index.js";

// `n` = number of raw points merged into a downsampled row (absent for raw rows).
export interface Sample {
  nodeId: string; timestamp: number; cpu: number; mem: number; disk: number;
  up: number; down: number; tx: number; rx: number; n?: number;
}
interface LatencySample { nodeId: string; taskId: string; timestamp: number; latencyMs: number; lossRate: number; jitter: number; n?: number }
interface HistoryData { samples: Sample[]; latency: LatencySample[] }
const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;
const RETENTION = 35 * DAY;
const MAX_POINTS = 300;
// Older data is kept at coarser resolution so the file stays bounded:
// raw for 24h, 5-minute buckets up to 7 days, hourly buckets up to the retention limit.
const TIERS = [{ age: 7 * DAY, width: HOUR }, { age: DAY, width: 5 * MINUTE }];

export function rangeStart(range: string, now = Date.now()): number {
  const durations: Record<string, number> = { "1h": HOUR, "6h": 6 * HOUR, "12h": 12 * HOUR, "1d": DAY, "3d": 3 * DAY, "7d": 7 * DAY, "30d": 30 * DAY };
  if (range === "all") return 0;
  if (range === "today") return new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  if (range === "month") return new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  return now - (durations[range] || durations["1h"]);
}

/** Index of the first row with timestamp >= ts (rows sorted ascending). */
function lowerBound(rows: { timestamp: number }[], ts: number): number {
  let lo = 0, hi = rows.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid].timestamp < ts) lo = mid + 1; else hi = mid; }
  return lo;
}

function insertSorted<T extends { timestamp: number }>(rows: T[], row: T) {
  if (!rows.length || rows[rows.length - 1].timestamp <= row.timestamp) rows.push(row);
  else rows.splice(lowerBound(rows, row.timestamp + 1), 0, row);
}

/** Keeps the latest row per time bucket so long ranges are evenly spread instead of index-strided. */
function thin<T extends { timestamp: number }>(rows: T[], start: number, end: number): T[] {
  const width = Math.max(MINUTE, Math.ceil((end - start) / MAX_POINTS));
  const result: T[] = [];
  let bucket = -1;
  for (const row of rows) {
    const b = Math.floor(row.timestamp / width);
    if (b === bucket) result[result.length - 1] = row; else { result.push(row); bucket = b; }
  }
  return result;
}

const round = (v: number) => Math.round(v * 100) / 100;

function mergeSamples(group: Sample[], timestamp: number): Sample {
  if (group.length === 1 && group[0].timestamp === timestamp) return group[0];
  let n = 0, cpu = 0, mem = 0, disk = 0, up = 0, down = 0, tx = 0, rx = 0;
  for (const p of group) {
    const w = p.n || 1; n += w;
    cpu += p.cpu * w; mem += p.mem * w; disk += p.disk * w; up += p.up * w; down += p.down * w;
    tx += p.tx; rx += p.rx;
  }
  return { nodeId: group[0].nodeId, timestamp, cpu: round(cpu / n), mem: round(mem / n), disk: round(disk / n), up: Math.round(up / n), down: Math.round(down / n), tx, rx, n };
}

function mergeLatency(group: LatencySample[], timestamp: number): LatencySample {
  if (group.length === 1 && group[0].timestamp === timestamp) return group[0];
  let n = 0, latencyMs = 0, lossRate = 0, jitter = 0;
  for (const p of group) { const w = p.n || 1; n += w; latencyMs += p.latencyMs * w; lossRate += p.lossRate * w; jitter += p.jitter * w; }
  return { nodeId: group[0].nodeId, taskId: group[0].taskId, timestamp, latencyMs: round(latencyMs / n), lossRate: round(lossRate / n), jitter: round(jitter / n), n };
}

/** Downsamples rows older than each tier boundary into buckets; rows must be sorted ascending. */
function compact<T extends { timestamp: number }>(rows: T[], now: number, keyOf: (row: T) => string, merge: (group: T[], timestamp: number) => T): T[] {
  const cutoff = now - RETENTION;
  let result = rows.slice(lowerBound(rows, cutoff));
  for (const { age, width } of TIERS) {
    const boundary = Math.floor((now - age) / width) * width;
    const split = lowerBound(result, boundary);
    if (!split) continue;
    const buckets = new Map<string, { timestamp: number; group: T[] }>();
    for (const row of result.slice(0, split)) {
      const timestamp = Math.floor(row.timestamp / width) * width;
      const key = `${keyOf(row)}|${timestamp}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.group.push(row); else buckets.set(key, { timestamp, group: [row] });
    }
    const merged = [...buckets.values()].map(b => merge(b.group, b.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
    result = merged.concat(result.slice(split));
  }
  return result;
}

export class HistoryStore {
  private samplesByNode = new Map<string, Sample[]>();
  private latencyByNode = new Map<string, LatencySample[]>();
  private timer?: NodeJS.Timeout;
  private dirty = false;
  constructor(private file = path.join(DATA_DIR, "telemetry-history.json")) {
    if (fs.existsSync(file)) {
      const value: HistoryData = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(value.samples) || !Array.isArray(value.latency)) throw new Error("Invalid telemetry history; original file retained");
      for (const p of value.samples) this.bucket(this.samplesByNode, p.nodeId).push(p);
      for (const p of value.latency) this.bucket(this.latencyByNode, p.nodeId).push(p);
      for (const rows of [...this.samplesByNode.values(), ...this.latencyByNode.values()]) rows.sort((a, b) => a.timestamp - b.timestamp);
    }
  }
  private bucket<T>(map: Map<string, T[]>, nodeId: string): T[] {
    let rows = map.get(nodeId);
    if (!rows) map.set(nodeId, rows = []);
    return rows;
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
    const now = Date.now();
    const samples: Sample[] = [], latency: LatencySample[] = [];
    for (const [nodeId, rows] of this.samplesByNode) {
      const kept = compact(rows, now, () => "", mergeSamples);
      if (kept.length) { this.samplesByNode.set(nodeId, kept); samples.push(...kept); } else this.samplesByNode.delete(nodeId);
    }
    for (const [nodeId, rows] of this.latencyByNode) {
      const kept = compact(rows, now, p => p.taskId, mergeLatency);
      if (kept.length) { this.latencyByNode.set(nodeId, kept); latency.push(...kept); } else this.latencyByNode.delete(nodeId);
    }
    atomicWriteJson(this.file, { samples, latency } satisfies HistoryData);
    this.dirty = false;
  }
  public record(node: NodeItem, tx: number, rx: number, now = Date.now()) {
    const timestamp = Math.floor(now / MINUTE) * MINUTE;
    const rows = this.bucket(this.samplesByNode, node.id);
    const metrics = { cpu: node.cpuUsage, mem: node.memUsage, disk: node.diskUsage, up: node.uplinkSpeedBytes, down: node.downlinkSpeedBytes };
    const previous = rows.findLast(p => p.timestamp === timestamp && !p.n);
    if (previous) Object.assign(previous, metrics, { tx: previous.tx + tx, rx: previous.rx + rx });
    else insertSorted(rows, { nodeId: node.id, timestamp, ...metrics, tx, rx });
    this.changed();
  }
  public recordLatency(nodeId: string, values: LatencySample[], now = Date.now()) {
    const rows = this.bucket(this.latencyByNode, nodeId);
    for (const value of values) {
      const previous = rows.findLast(p => p.taskId === value.taskId);
      if (previous && now - previous.timestamp < 1000) continue;
      insertSorted(rows, { ...value, nodeId, timestamp: now });
    }
    if (values.length) this.changed();
  }
  public samples(range: string, nodeId?: string): Sample[] {
    const start = Math.max(rangeStart(range), Date.now() - RETENTION);
    const pick = (rows: Sample[]) => rows.slice(lowerBound(rows, start));
    if (nodeId) return pick(this.samplesByNode.get(nodeId) || []);
    return [...this.samplesByNode.values()].flatMap(pick);
  }
  public loadHistory(nodeId: string, range: string) {
    const all = this.samples(range, nodeId);
    const rows = all.length ? thin(all, all[0].timestamp, Date.now()) : all;
    return { timestamps: rows.map(p => p.timestamp), cpu: rows.map(p => p.cpu), mem: rows.map(p => p.mem), disk: rows.map(p => p.disk), netIn: rows.map(p => p.down), netOut: rows.map(p => p.up) };
  }
  public latencyHistory(nodeId: string, range: string, tasks: LatencyTask[]): NodeLatencyHistory[] {
    const start = rangeStart(range);
    const rows = this.latencyByNode.get(nodeId) || [];
    const recent = rows.slice(lowerBound(rows, start));
    return tasks.filter(t => t.enabled && (!t.nodeIds.length || t.nodeIds.includes(nodeId))).flatMap(task => {
      const points = recent.filter(p => p.taskId === task.id);
      if (!points.length) return [];
      const latest = points[points.length - 1];
      return [{ nodeId, taskId: task.id, taskName: task.name, color: "#3b82f6", currentLatency: latest.latencyMs, lossRate: latest.lossRate, jitter: latest.jitter, history: thin(points, points[0].timestamp, Date.now()) }];
    });
  }
}
export const historyStore = new HistoryStore();
