import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { atomicWriteJson, deriveRealityPublicKey, billingPeriod, hashPassword, verifyPassword, newId } from "../services/security.js";
import { historyStore } from "../services/historyStore.js";
import { DATA_DIR } from "../paths.js";
import { InputError } from "../services/validation.js";
import { LEGACY_DEFAULT_PASSWORD, PASSWORD_MIN_LENGTH } from "../constants.js";
import type {
  NodeItem,
  RelayLink,
  SubscriptionToken,
  SystemConfig,
  LatencyTask,
  TelegramConfig,
  TelegramAlertLog,
  AdminUser,
} from "../types/index.js";

const DATA_FILE = path.join(DATA_DIR, "nodemaster_db.json");

export interface DatabaseSchema {
  nodes: NodeItem[];
  relays: RelayLink[];
  subscriptions: SubscriptionToken[];
  config: SystemConfig;
  latencyTasks: LatencyTask[];
  telegramConfig: TelegramConfig;
  telegramLogs: TelegramAlertLog[];
  admin: AdminUser;
  // Bumped whenever generated node configs or stored shapes change, so upgrades migrate exactly once
  configSchemaVersion: number;
}

// 2: chained relays get a dedicated client UUID; server routing blocks private ranges and maps PROXY to DIRECT
// 3: routing rules are built-in constants; legacy relay/subscription/node fields removed; default subscription seeded
const CONFIG_SCHEMA_VERSION = 3;
const MAX_TELEGRAM_LOGS = 100;

const DEFAULT_CONFIG: Omit<SystemConfig, "jwtSecret"> = {
  autoCircuitBreaker: true,
  circuitBreakerThresholdPct: 98,
  trafficResetDay: 1,
};

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  enabled: false,
  botToken: "",
  chatId: "",
  apiEndpoint: "https://api.telegram.org",
  offlineAlert: true,
  trafficAlert: true,
  trafficThresholdPercent: 80,
  renewalAlert: true,
  renewalDaysAhead: 7,
  cpuAlert: true,
  cpuThresholdPercent: 85,
  memAlert: true,
  memThresholdPercent: 85,
};

const latencyPreset = (id: string, name: string, host: string, order: number): LatencyTask =>
  ({ id, name, target: `${host}.ip.zstaticcdn.com:80`, type: "tcp", intervalSec: 60, nodeIds: [], enabled: true, order });

export const INITIAL_LATENCY_TASKS: readonly LatencyTask[] = [
  latencyPreset("task-gd-cm", "广东移动", "gd-cm-v4", 1),
  latencyPreset("task-gd-cu", "广东联通", "gd-cu-v4", 2),
  latencyPreset("task-gd-ct", "广东电信", "gd-ct-v4", 3),
  latencyPreset("task-hb-cm", "湖北移动", "hb-cm-v4", 4),
  latencyPreset("task-hb-cu", "湖北联通", "hb-cu-v4", 5),
  latencyPreset("task-hb-ct", "湖北电信", "hb-ct-v4", 6),
  latencyPreset("task-sc-cm", "四川移动", "sc-cm-v4", 7),
  latencyPreset("task-sc-cu", "四川联通", "sc-cu-v4", 8),
  latencyPreset("task-sc-ct", "四川电信", "sc-ct-v4", 9),
];

const newJwtSecret = () => crypto.randomBytes(48).toString("base64url");

export function makeSubscription(name = "专属订阅", nodeIds: string[] = [], expireAt = 0): SubscriptionToken {
  return { id: newId("sub"), name, token: `sub_${crypto.randomBytes(12).toString("hex")}`, nodeIds, expireAt, createdAt: Date.now() };
}

/** Fields that force a node to re-pull its Xray config. */
export function bumpConfigVersion(node: Pick<NodeItem, "configVersion">, now = Date.now()) {
  return { configVersion: Math.max(now, (node.configVersion || 0) + 1), configSyncStatus: "pending" as const };
}

function createAdmin(): AdminUser {
  const password = process.env.NODEMASTER_ADMIN_PASSWORD || crypto.randomBytes(24).toString("base64url");
  if (password.length < PASSWORD_MIN_LENGTH || password === LEGACY_DEFAULT_PASSWORD) {
    throw new Error(`Initial admin password must contain at least ${PASSWORD_MIN_LENGTH} characters and cannot be the legacy password`);
  }
  if (!process.env.NODEMASTER_ADMIN_PASSWORD) {
    const credentialsPath = path.join(DATA_DIR, "bootstrap-admin.txt");
    fs.writeFileSync(credentialsPath, password, { mode: 0o600 });
    console.warn(`[Security] Initial admin password saved to ${credentialsPath}; change it after login and delete this file.`);
  }
  const { hash, salt } = hashPassword(password);
  return { username: "admin", passwordHash: hash, salt, sessionVersion: crypto.randomUUID(), updatedAt: Date.now() };
}

function createDefault(): DatabaseSchema {
  return {
    nodes: [],
    relays: [],
    subscriptions: [makeSubscription()],
    config: { ...DEFAULT_CONFIG, jwtSecret: newJwtSecret() },
    latencyTasks: structuredClone(INITIAL_LATENCY_TASKS) as LatencyTask[],
    telegramConfig: { ...DEFAULT_TELEGRAM_CONFIG },
    telegramLogs: [],
    admin: createAdmin(),
    configSchemaVersion: CONFIG_SCHEMA_VERSION,
  };
}

/** Upgrades a database written by any earlier release in place. Returns whether anything changed. */
function migrate(data: any): boolean {
  let changed = false;
  const fill = <K extends keyof DatabaseSchema>(key: K, value: () => DatabaseSchema[K]) => {
    if (!data[key]) { data[key] = value(); changed = true; }
  };
  fill("latencyTasks", () => structuredClone(INITIAL_LATENCY_TASKS) as LatencyTask[]);
  fill("telegramConfig", () => ({ ...DEFAULT_TELEGRAM_CONFIG }));
  fill("telegramLogs", () => []);
  fill("admin", createAdmin);

  if (!data.config.jwtSecret || data.config.jwtSecret.length < 32 || data.config.jwtSecret === "nm_secret_key_8848_secure") {
    data.config.jwtSecret = newJwtSecret();
    changed = true;
  }
  if (verifyPassword(LEGACY_DEFAULT_PASSWORD, data.admin.passwordHash, data.admin.salt)) {
    data.admin = { ...createAdmin(), username: data.admin.username };
    changed = true;
  }
  if (!data.admin.sessionVersion) {
    data.admin.sessionVersion = crypto.randomUUID();
    changed = true;
  }
  // Explicit, opt-in recovery for a forgotten password. A separate variable is used so that
  // leaving NODEMASTER_ADMIN_PASSWORD set never silently reverts a password changed in the UI.
  const resetPassword = process.env.NODEMASTER_RESET_ADMIN_PASSWORD;
  if (resetPassword && (resetPassword.length < PASSWORD_MIN_LENGTH || resetPassword === LEGACY_DEFAULT_PASSWORD)) {
    console.error(`[Security] NODEMASTER_RESET_ADMIN_PASSWORD ignored: it must contain at least ${PASSWORD_MIN_LENGTH} characters and cannot be the legacy password.`);
  } else if (resetPassword && !verifyPassword(resetPassword, data.admin.passwordHash, data.admin.salt)) {
    // Skipped when already applied, so restarts with the variable still set don't revoke sessions again.
    const { hash, salt } = hashPassword(resetPassword);
    data.admin = { ...data.admin, passwordHash: hash, salt, sessionVersion: crypto.randomUUID(), updatedAt: Date.now() };
    changed = true;
    console.warn("[Security] Admin password was reset from NODEMASTER_RESET_ADMIN_PASSWORD and all sessions were revoked. Remove the variable now.");
  }

  for (const n of data.nodes as NodeItem[]) {
    if (n.reality) {
      const publicKey = deriveRealityPublicKey(n.reality.privateKey);
      if (publicKey !== n.reality.publicKey) { n.reality.publicKey = publicKey; changed = true; }
    }
    if (!n.trafficPeriodStart) {
      n.trafficPeriodStart = billingPeriod(Date.now(), n.trafficResetDay || 1);
      changed = true;
    }
    if (!n.agentSchemaVersion) {
      Object.assign(n, { agentSchemaVersion: 2, configVersion: Date.now(), configSyncStatus: "pending" });
      n.status = n.status === "circuit_broken" ? n.status : "offline";
      changed = true;
    }
  }
  for (const r of data.relays) {
    if (!r.chainUuid) { r.chainUuid = crypto.randomUUID(); changed = true; }
  }

  if ((data.configSchemaVersion || 0) < CONFIG_SCHEMA_VERSION) {
    // v3 shape cleanup: one name per relay endpoint, protocol decides the node role, no dead fields
    for (const r of data.relays) {
      r.mainNodeId ||= r.transitNodeId;
      r.unlockNodeId ||= r.exitNodeId;
      for (const key of ["transitNodeId", "exitNodeId", "transitPort", "trafficBytes", "latencyMs"]) delete r[key];
    }
    for (const n of data.nodes) {
      if (n.protocol !== "shadowsocks" && n.protocol !== "probe") n.protocol = "vless-reality";
      n.type = n.protocol === "shadowsocks" ? "unlock" : n.protocol === "probe" ? "probe" : "direct";
      delete n.sni;
    }
    for (const s of data.subscriptions) { delete s.trafficLimitBytes; delete s.trafficUsedBytes; }
    for (const key of ["port", "host", "panelUrl"]) delete data.config[key];
    delete data.routingRules;
    if (data.subscriptions.length === 0) data.subscriptions.push(makeSubscription());

    data.configSchemaVersion = CONFIG_SCHEMA_VERSION;
    for (const n of data.nodes) Object.assign(n, bumpConfigVersion(n));
    changed = true;
  }
  return changed;
}

export class Database {
  private data: DatabaseSchema;
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      this.data = createDefault();
      this.save();
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      if (!Array.isArray(data.nodes) || !Array.isArray(data.relays) || !Array.isArray(data.subscriptions) || !data.config) {
        throw new Error("Invalid database schema");
      }
      const changed = migrate(data);
      this.data = data;
      if (changed) {
        const migrationBackup = `${DATA_FILE}.pre-migration.bak`;
        if (!fs.existsSync(migrationBackup)) fs.copyFileSync(DATA_FILE, migrationBackup);
        this.save();
      }
    } catch (err) {
      throw new Error(`Cannot load database ${DATA_FILE}; original retained. Restore a verified backup before restarting.`, { cause: err });
    }
  }

  private save() {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    atomicWriteJson(DATA_FILE, this.data, true);
  }

  public flush() { this.save(); historyStore.flush(); }

  /** Coalesces frequent, non-critical writes (telemetry, alert history) into one write per second. */
  private scheduleSave() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      try { this.save(); } catch (error) { console.error("Database flush failed", error); this.scheduleSave(); }
    }, 1000);
    this.flushTimer.unref();
  }

  public invalidateConfigs(nodeIds?: string[]) {
    for (const node of this.data.nodes) {
      if (!nodeIds || nodeIds.includes(node.id)) Object.assign(node, bumpConfigVersion(node));
    }
    this.save();
  }

  public revokeSessions() {
    this.updateAdmin({ sessionVersion: crypto.randomUUID() });
  }

  // Nodes
  public getNodes(): NodeItem[] { return this.data.nodes; }
  public getNodeById(id: string) { return this.data.nodes.find(n => n.id === id); }
  public getNodeByToken(token: string) { return this.data.nodes.find(n => n.token === token); }

  public addNode(node: NodeItem): NodeItem {
    this.data.nodes.push(node);
    this.save();
    return node;
  }

  public updateNode(id: string, updates: Partial<NodeItem>, defer = false): NodeItem | null {
    const idx = this.data.nodes.findIndex(n => n.id === id);
    if (idx === -1) return null;
    this.data.nodes[idx] = { ...this.data.nodes[idx], ...updates };
    if (defer) this.scheduleSave(); else this.save();
    return this.data.nodes[idx];
  }

  public deleteNode(id: string): boolean {
    const before = this.data.nodes.length;
    this.data.nodes = this.data.nodes.filter(n => n.id !== id);
    this.data.relays = this.data.relays.filter(r => r.mainNodeId !== id && r.unlockNodeId !== id);
    for (const s of this.data.subscriptions) s.nodeIds = s.nodeIds.filter(nodeId => nodeId !== id);
    this.invalidateConfigs();
    return this.data.nodes.length < before;
  }

  // Relays
  public getRelays(): RelayLink[] { return this.data.relays; }
  public getRelayById(id: string) { return this.data.relays.find(r => r.id === id); }
  /** The active relay whose main node is `nodeId`, if any (at most one exists). */
  public getActiveRelayFor(nodeId: string) { return this.data.relays.find(r => r.status === "active" && r.mainNodeId === nodeId); }

  public addRelay(relay: RelayLink): RelayLink {
    this.data.relays.push(relay);
    this.invalidateConfigs();
    return relay;
  }

  public updateRelay(id: string, updates: Partial<RelayLink>): RelayLink | null {
    const relay = this.getRelayById(id);
    if (!relay) return null;
    Object.assign(relay, updates);
    this.invalidateConfigs();
    return relay;
  }

  public deleteRelay(id: string): boolean {
    const before = this.data.relays.length;
    this.data.relays = this.data.relays.filter(r => r.id !== id);
    this.invalidateConfigs();
    return this.data.relays.length < before;
  }

  // Subscriptions
  public getSubscriptions(): SubscriptionToken[] { return this.data.subscriptions; }
  public getSubscriptionByToken(token: string) { return this.data.subscriptions.find(s => s.token === token); }

  public addSubscription(sub: SubscriptionToken): SubscriptionToken {
    this.data.subscriptions.push(sub);
    this.save();
    return sub;
  }

  /** Returns null when the subscription is missing; throws when the new token is already taken. */
  public updateSubscription(id: string, updates: Partial<SubscriptionToken>): SubscriptionToken | null {
    const sub = this.data.subscriptions.find(s => s.id === id);
    if (!sub) return null;
    if (updates.token && this.data.subscriptions.some(s => s.id !== id && s.token === updates.token)) {
      throw new InputError("Token 已被占用，请更换其他 Token");
    }
    Object.assign(sub, updates);
    this.save();
    return sub;
  }

  public deleteSubscription(id: string): boolean {
    const before = this.data.subscriptions.length;
    this.data.subscriptions = this.data.subscriptions.filter(s => s.id !== id);
    this.save();
    return this.data.subscriptions.length < before;
  }

  // Admin
  public getAdmin(): AdminUser { return this.data.admin; }

  public updateAdmin(updates: Partial<AdminUser>): AdminUser {
    this.data.admin = { ...this.data.admin, ...updates, updatedAt: Date.now() };
    this.save();
    return this.data.admin;
  }

  // Config
  public getConfig(): SystemConfig { return this.data.config; }

  // Latency tasks
  public getLatencyTasks(): LatencyTask[] {
    return [...this.data.latencyTasks].sort((a, b) => a.order - b.order);
  }

  /** Enabled tasks that apply to the given node (an empty node list means all nodes). */
  public getLatencyTasksFor(nodeId: string): LatencyTask[] {
    return this.getLatencyTasks().filter(t => t.enabled && (!t.nodeIds.length || t.nodeIds.includes(nodeId)));
  }

  public getLatencyTaskById(id: string) { return this.data.latencyTasks.find(t => t.id === id); }

  public addLatencyTask(task: LatencyTask): LatencyTask {
    this.data.latencyTasks.push(task);
    this.save();
    return task;
  }

  public updateLatencyTask(id: string, updates: Partial<LatencyTask>): LatencyTask | null {
    const task = this.getLatencyTaskById(id);
    if (!task) return null;
    Object.assign(task, updates);
    this.save();
    return task;
  }

  public deleteLatencyTask(id: string): boolean {
    const before = this.data.latencyTasks.length;
    this.data.latencyTasks = this.data.latencyTasks.filter(t => t.id !== id);
    this.save();
    return this.data.latencyTasks.length < before;
  }

  public resetLatencyTasks(): LatencyTask[] {
    this.data.latencyTasks = structuredClone(INITIAL_LATENCY_TASKS) as LatencyTask[];
    this.save();
    return this.getLatencyTasks();
  }

  /** Listed ids come first in the given order; unlisted tasks keep their relative order after them. */
  public reorderLatencyTasks(orderedIds: string[]): LatencyTask[] {
    const rank = (id: string) => { const i = orderedIds.indexOf(id); return i === -1 ? Infinity : i; };
    const sorted = this.getLatencyTasks().sort((a, b) => rank(a.id) - rank(b.id));
    sorted.forEach((task, index) => { task.order = index + 1; });
    this.data.latencyTasks = sorted;
    this.save();
    return this.getLatencyTasks();
  }

  // Telegram
  public getTelegramConfig(): TelegramConfig { return this.data.telegramConfig; }

  public updateTelegramConfig(updates: Partial<TelegramConfig>): TelegramConfig {
    this.data.telegramConfig = { ...this.data.telegramConfig, ...updates };
    this.save();
    return this.data.telegramConfig;
  }

  public getTelegramLogs(): TelegramAlertLog[] { return this.data.telegramLogs; }

  public addTelegramLog(log: TelegramAlertLog): void {
    this.data.telegramLogs = [log, ...this.data.telegramLogs].slice(0, MAX_TELEGRAM_LOGS);
    // Alert history is not critical state; coalesce bursts of alerts into one write.
    this.scheduleSave();
  }

  public clearTelegramLogs(): void {
    this.data.telegramLogs = [];
    this.save();
  }
}

export const db = new Database();
