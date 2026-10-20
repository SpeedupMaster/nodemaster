import "dotenv/config";
import fs from "fs";
import { atomicWriteJson, deriveRealityPublicKey, billingPeriod } from "../services/security.js";
import { historyStore } from "../services/historyStore.js";
import { DATA_DIR } from "../paths.js";
import path from "path";
import crypto from "crypto";
import {
  NodeItem,
  RelayLink,
  SubscriptionToken,
  SystemConfig,
  LatencyTask,
  NodeLatencyHistory,
  RoutingRule,
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
  routingRules: RoutingRule[];
  telegramConfig?: TelegramConfig;
  telegramLogs?: TelegramAlertLog[];
  admin?: AdminUser;
}

const DEFAULT_CONFIG: SystemConfig = {
  port: 3880,
  host: "0.0.0.0",
  jwtSecret: "",
  panelUrl: "http://127.0.0.1:3880",
  autoCircuitBreaker: true,
  circuitBreakerThresholdPct: 98,
  trafficResetDay: 1,
};

const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
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

export const INITIAL_LATENCY_TASKS: LatencyTask[] = [
  {
    id: "task-gd-cm",
    name: "广东移动",
    target: "gd-cm-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 1,
  },
  {
    id: "task-gd-cu",
    name: "广东联通",
    target: "gd-cu-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 2,
  },
  {
    id: "task-gd-ct",
    name: "广东电信",
    target: "gd-ct-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 3,
  },
  {
    id: "task-hb-cm",
    name: "湖北移动",
    target: "hb-cm-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 4,
  },
  {
    id: "task-hb-cu",
    name: "湖北联通",
    target: "hb-cu-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 5,
  },
  {
    id: "task-hb-ct",
    name: "湖北电信",
    target: "hb-ct-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 6,
  },
  {
    id: "task-sc-cm",
    name: "四川移动",
    target: "sc-cm-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 7,
  },
  {
    id: "task-sc-cu",
    name: "四川联通",
    target: "sc-cu-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 8,
  },
  {
    id: "task-sc-ct",
    name: "四川电信",
    target: "sc-ct-v4.ip.zstaticcdn.com:80",
    type: "tcp",
    intervalSec: 60,
    nodeIds: [],
    enabled: true,
    order: 9,
  },
];

export const INITIAL_ROUTING_RULES: RoutingRule[] = [
  {
    id: "rule-private-lan",
    name: "私有局域网与回环",
    description: "局域网及私有 IP 地址直连互通，避免内部网络请求走代理",
    enabled: true,
    priority: 1,
    targetOutbound: "DIRECT",
    geosite: ["private"],
    geoip: ["private"],
    ips: ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
    inboundNodeIds: [],
    builtInPresetId: "preset_lan",
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "rule-block-p2p",
    name: "BitTorrent / P2P 防封拦截",
    description: "阻断 BT/PT 下载流量，防止 VPS 被版权投诉或机房直接封机",
    enabled: true,
    priority: 2,
    targetOutbound: "BLOCK",
    protocol: ["bittorrent"],
    inboundNodeIds: [],
    builtInPresetId: "preset_p2p",
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "rule-ai-services",
    name: "AI 办公全家桶 (OpenAI / Claude / Gemini)",
    description: "自动导向落地解锁机出口，保障 ChatGPT、Claude 与 Gemini 稳定防封号",
    enabled: true,
    priority: 3,
    targetOutbound: "UNLOCK_OUT",
    geosite: ["openai", "anthropic", "category-ai-chat-!cn"],
    domains: ["openai.com", "chatgpt.com", "oaistatic.com", "oaiusercontent.com", "claude.ai", "anthropic.com", "gemini.google.com"],
    inboundNodeIds: [],
    builtInPresetId: "preset_ai",
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 20,
  },
  {
    id: "rule-global-streaming",
    name: "全球主流流媒体解锁",
    description: "Netflix / Disney+ / YouTube / TikTok 自动路由至流媒体原生解锁落地机",
    enabled: true,
    priority: 4,
    targetOutbound: "UNLOCK_OUT",
    geosite: ["netflix", "disney", "youtube", "tiktok", "spotify"],
    domains: ["netflix.com", "disneyplus.com", "youtube.com", "tiktok.com"],
    inboundNodeIds: [],
    builtInPresetId: "preset_streaming",
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 20,
  },
  {
    id: "rule-telegram",
    name: "Telegram 海外即时通讯",
    description: "Telegram 专属 IP 与域名通过代理出口极速分流直达",
    enabled: true,
    priority: 5,
    targetOutbound: "PROXY",
    geosite: ["telegram"],
    geoip: ["telegram"],
    inboundNodeIds: [],
    builtInPresetId: "preset_telegram",
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 15,
  },
  {
    id: "rule-cn-direct",
    name: "中国大陆流量直连",
    description: "国内域名与 IP 直连，降低访问延迟并节省 VPS 宝贵带宽流量",
    enabled: true,
    priority: 6,
    targetOutbound: "DIRECT",
    geosite: ["cn"],
    geoip: ["cn"],
    inboundNodeIds: [],
    builtInPresetId: "preset_cn",
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "rule-fallback",
    name: "漏网之鱼兜底 (Final Match)",
    description: "未命中上述规则的境外网络流量，默认通过代理节点中继转发",
    enabled: true,
    priority: 7,
    targetOutbound: "PROXY",
    inboundNodeIds: [],
    builtInPresetId: "preset_fallback",
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
];

export class Database {
  private data: DatabaseSchema;
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        this.data = JSON.parse(raw);
        if (!Array.isArray(this.data.nodes) || !Array.isArray(this.data.relays) || !Array.isArray(this.data.subscriptions) || !this.data.config) {
          throw new Error("Invalid database schema");
        }
        let changed = false;
        if (!this.data.latencyTasks) {
          this.data.latencyTasks = structuredClone(INITIAL_LATENCY_TASKS);
          changed = true;
        }
        if (!this.data.routingRules) {
          this.data.routingRules = JSON.parse(JSON.stringify(INITIAL_ROUTING_RULES));
          changed = true;
        }
        if (!this.data.telegramConfig) {
          this.data.telegramConfig = { ...DEFAULT_TELEGRAM_CONFIG };
          changed = true;
        }
        if (!this.data.telegramLogs) {
          this.data.telegramLogs = [];
          changed = true;
        }
        if (!this.data.admin) {
          this.data.admin = this.createDefaultAdmin();
          changed = true;
        }
        if (!this.data.config.jwtSecret || this.data.config.jwtSecret.length < 32 || this.data.config.jwtSecret === "nm_secret_key_8848_secure") {
          this.data.config.jwtSecret = crypto.randomBytes(48).toString("base64url");
          changed = true;
        }
        const admin = this.data.admin!;
        const oldHash = crypto.pbkdf2Sync("admin123456", admin.salt, 100000, 64, "sha512").toString("hex");
        if (admin.passwordHash === oldHash) {
          this.data.admin = { ...this.createDefaultAdmin(), username: admin.username };
          changed = true;
        }
        if (!this.data.admin!.sessionVersion) {
          this.data.admin!.sessionVersion = crypto.randomUUID();
          changed = true;
        }
        for (const n of this.data.nodes) {
          if (n.reality) {
            const publicKey = deriveRealityPublicKey(n.reality.privateKey);
            if (publicKey !== n.reality.publicKey) {
              n.reality.publicKey = publicKey;
              changed = true;
            }
          }
          if (!n.trafficPeriodStart) {
            n.trafficPeriodStart = billingPeriod(Date.now(), n.trafficResetDay || 1);
            changed = true;
          }
          if (!n.agentSchemaVersion) {
            n.agentSchemaVersion = 2;
            n.configVersion = Date.now();
            n.configSyncStatus = "pending";
            n.status = n.status === "circuit_broken" ? n.status : "offline";
            changed = true;
          }
        }
        if (changed) {
          const migrationBackup = `${DATA_FILE}.pre-migration.bak`;
          if (!fs.existsSync(migrationBackup)) fs.copyFileSync(DATA_FILE, migrationBackup);
          this.save();
        }
      } catch (err) {
        throw new Error(`Cannot load database ${DATA_FILE}; original retained. Restore a verified backup before restarting.`, { cause: err });
      }
    } else {
      this.data = this.createDefault();
      this.save();
    }
  }

  private createDefaultAdmin(): AdminUser {
    const salt = crypto.randomBytes(16).toString("hex");
    const password = process.env.NODEMASTER_ADMIN_PASSWORD || crypto.randomBytes(24).toString("base64url");
    if (password.length < 12 || password === "admin123456") throw new Error("Initial admin password must contain at least 12 characters and cannot be the legacy password");
    if (!process.env.NODEMASTER_ADMIN_PASSWORD) {
      const credentialsPath = path.join(DATA_DIR, "bootstrap-admin.txt");
      fs.writeFileSync(credentialsPath, password, { mode: 0o600 });
      console.warn(`[Security] Initial admin password saved to ${credentialsPath}; change it after login and delete this file.`);
    }
    const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return {
      username: "admin",
      passwordHash,
      salt,
      sessionVersion: crypto.randomUUID(),
      updatedAt: Date.now(),
    };
  }

  private createDefault(): DatabaseSchema {
    return {
      nodes: [],
      relays: [],
      subscriptions: [],
      config: { ...DEFAULT_CONFIG, jwtSecret: crypto.randomBytes(48).toString("base64url") },
      latencyTasks: [...INITIAL_LATENCY_TASKS],
      routingRules: JSON.parse(JSON.stringify(INITIAL_ROUTING_RULES)),
      telegramConfig: { ...DEFAULT_TELEGRAM_CONFIG },
      telegramLogs: [],
      admin: this.createDefaultAdmin(),
    };
  }

  private save() {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    atomicWriteJson(DATA_FILE, this.data, true);
  }

  public flush() { this.save(); historyStore.flush(); }

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
      if (nodeIds && !nodeIds.includes(node.id)) continue;
      node.configVersion = Math.max(Date.now(), (node.configVersion || 0) + 1);
      node.configSyncStatus = "pending";
    }
    this.save();
  }

  public revokeSessions() {
    this.updateAdmin({ sessionVersion: crypto.randomUUID() });
  }

  // Nodes API
  public getNodes(): NodeItem[] {
    return this.data.nodes;
  }

  public getNodeById(id: string): NodeItem | undefined {
    return this.data.nodes.find(n => n.id === id);
  }

  public getNodeByToken(token: string): NodeItem | undefined {
    return this.data.nodes.find(n => n.token === token);
  }

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
    this.data.relays = this.data.relays.filter(r => r.transitNodeId !== id && r.exitNodeId !== id);
    this.invalidateConfigs();
    return this.data.nodes.length < before;
  }

  // Relays API
  public getRelays(): RelayLink[] {
    return this.data.relays;
  }

  public getRelayById(id: string): RelayLink | undefined {
    return this.data.relays.find(r => r.id === id);
  }

  public addRelay(relay: RelayLink): RelayLink {
    this.data.relays.push(relay);
    this.invalidateConfigs();
    return relay;
  }

  public updateRelay(id: string, updates: Partial<RelayLink>): RelayLink | null {
    const idx = this.data.relays.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.data.relays[idx] = {
      ...this.data.relays[idx],
      ...updates,
    };
    this.invalidateConfigs();
    return this.data.relays[idx];
  }

  public deleteRelay(id: string): boolean {
    const before = this.data.relays.length;
    this.data.relays = this.data.relays.filter(r => r.id !== id);
    this.invalidateConfigs();
    return this.data.relays.length < before;
  }

  // Subscriptions API
  public getSubscriptions(): SubscriptionToken[] {
    return this.data.subscriptions;
  }

  public getSubscriptionByToken(token: string): SubscriptionToken | undefined {
    return this.data.subscriptions.find(s => s.token === token);
  }

  public addSubscription(sub: SubscriptionToken): SubscriptionToken {
    this.data.subscriptions.push(sub);
    this.save();
    return sub;
  }

  public updateSubscription(id: string, updates: Partial<SubscriptionToken>): SubscriptionToken | null {
    const sub = this.data.subscriptions.find(s => s.id === id);
    if (!sub) return null;

    if (updates.token && updates.token !== sub.token) {
      const exists = this.data.subscriptions.some(s => s.id !== id && s.token === updates.token);
      if (exists) {
        throw new Error("Token 已被占用，请更换其他 Token");
      }
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

  // Admin API
  public getAdmin(): AdminUser {
    if (!this.data.admin) {
      this.data.admin = this.createDefaultAdmin();
      this.save();
    }
    return this.data.admin;
  }

  public updateAdmin(updates: Partial<AdminUser>): AdminUser {
    const current = this.getAdmin();
    this.data.admin = { ...current, ...updates, updatedAt: Date.now() };
    this.save();
    return this.data.admin;
  }

  // Config API
  public getConfig(): SystemConfig {
    return this.data.config;
  }

  public updateConfig(updates: Partial<SystemConfig>): SystemConfig {
    this.data.config = { ...this.data.config, ...updates };
    this.save();
    return this.data.config;
  }

  // Latency Tasks API
  public getLatencyTasks(): LatencyTask[] {
    return (this.data.latencyTasks || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  public getLatencyTaskById(id: string): LatencyTask | undefined {
    return (this.data.latencyTasks || []).find(t => t.id === id);
  }

  public addLatencyTask(task: LatencyTask): LatencyTask {
    if (!this.data.latencyTasks) this.data.latencyTasks = [];
    this.data.latencyTasks.push(task);
    this.save();
    return task;
  }

  public updateLatencyTask(id: string, updates: Partial<LatencyTask>): LatencyTask | null {
    if (!this.data.latencyTasks) this.data.latencyTasks = [];
    const idx = this.data.latencyTasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.data.latencyTasks[idx] = { ...this.data.latencyTasks[idx], ...updates };
    this.save();
    return this.data.latencyTasks[idx];
  }

  public deleteLatencyTask(id: string): boolean {
    if (!this.data.latencyTasks) return false;
    const before = this.data.latencyTasks.length;
    this.data.latencyTasks = this.data.latencyTasks.filter(t => t.id !== id);
    this.save();
    return this.data.latencyTasks.length < before;
  }

  public resetLatencyTasks(): LatencyTask[] {
    this.data.latencyTasks = structuredClone(INITIAL_LATENCY_TASKS);
    this.save();
    return this.getLatencyTasks();
  }

  public reorderLatencyTasks(orderedIds: string[]): LatencyTask[] {
    if (!this.data.latencyTasks) this.data.latencyTasks = [];
    const map = new Map(this.data.latencyTasks.map(t => [t.id, t]));
    const reordered: LatencyTask[] = [];
    orderedIds.forEach((id, index) => {
      const task = map.get(id);
      if (task) {
        task.order = index + 1;
        reordered.push(task);
        map.delete(id);
      }
    });
    for (const remaining of map.values()) {
      remaining.order = reordered.length + 1;
      reordered.push(remaining);
    }
    this.data.latencyTasks = reordered;
    this.save();
    return this.getLatencyTasks();
  }

  public getNodeLatencyHistory(nodeId: string, range = "1h"): NodeLatencyHistory[] {
    return historyStore.latencyHistory(nodeId, range, this.getLatencyTasks());
  }
  public getNodeLoadHistory(nodeId: string, range = "1h") {
    return this.getNodeById(nodeId) ? historyStore.loadHistory(nodeId, range) : null;
  }

  // Routing Rules API
  public getRoutingRules(): RoutingRule[] {
    if (!this.data.routingRules) {
      this.data.routingRules = JSON.parse(JSON.stringify(INITIAL_ROUTING_RULES));
      this.save();
    }
    return [...this.data.routingRules].sort((a, b) => a.priority - b.priority);
  }

  public getRoutingRuleById(id: string): RoutingRule | undefined {
    return this.getRoutingRules().find(r => r.id === id);
  }

  public addRoutingRule(rule: RoutingRule): RoutingRule {
    if (!this.data.routingRules) this.data.routingRules = [];
    if (!rule.priority) {
      const maxPriority = this.data.routingRules.reduce((max, r) => Math.max(max, r.priority || 0), 0);
      rule.priority = maxPriority + 1;
    }
    this.data.routingRules.push(rule);
    this.invalidateConfigs();
    return rule;
  }

  public updateRoutingRule(id: string, updates: Partial<RoutingRule>): RoutingRule | null {
    if (!this.data.routingRules) return null;
    const idx = this.data.routingRules.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.data.routingRules[idx] = {
      ...this.data.routingRules[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    this.invalidateConfigs();
    return this.data.routingRules[idx];
  }

  public deleteRoutingRule(id: string): boolean {
    if (!this.data.routingRules) return false;
    const before = this.data.routingRules.length;
    this.data.routingRules = this.data.routingRules.filter(r => r.id !== id);
    this.data.routingRules.sort((a, b) => a.priority - b.priority);
    this.data.routingRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    this.invalidateConfigs();
    return this.data.routingRules.length < before;
  }

  public reorderRoutingRules(orderedIds: string[]): RoutingRule[] {
    if (!this.data.routingRules) this.data.routingRules = [];
    const ruleMap = new Map<string, RoutingRule>();
    this.data.routingRules.forEach(r => ruleMap.set(r.id, r));

    const reordered: RoutingRule[] = [];
    orderedIds.forEach((id, index) => {
      const rule = ruleMap.get(id);
      if (rule) {
        rule.priority = index + 1;
        rule.updatedAt = Date.now();
        reordered.push(rule);
        ruleMap.delete(id);
      }
    });

    let nextPriority = reordered.length + 1;
    ruleMap.forEach(remainingRule => {
      remainingRule.priority = nextPriority++;
      reordered.push(remainingRule);
    });

    this.data.routingRules = reordered;
    this.invalidateConfigs();
    return this.getRoutingRules();
  }

  public resetRoutingRules(): RoutingRule[] {
    this.data.routingRules = JSON.parse(JSON.stringify(INITIAL_ROUTING_RULES));
    this.invalidateConfigs();
    return this.getRoutingRules();
  }

  // Telegram Notification API
  public getTelegramConfig(): TelegramConfig {
    if (!this.data.telegramConfig) {
      this.data.telegramConfig = { ...DEFAULT_TELEGRAM_CONFIG };
      this.save();
    }
    return this.data.telegramConfig;
  }

  public updateTelegramConfig(updates: Partial<TelegramConfig>): TelegramConfig {
    this.data.telegramConfig = {
      ...this.getTelegramConfig(),
      ...updates,
    };
    this.save();
    return this.data.telegramConfig;
  }

  public getTelegramLogs(): TelegramAlertLog[] {
    return this.data.telegramLogs || [];
  }

  public addTelegramLog(log: TelegramAlertLog): void {
    if (!this.data.telegramLogs) {
      this.data.telegramLogs = [];
    }
    this.data.telegramLogs.unshift(log);
    // Keep last 100 logs
    if (this.data.telegramLogs.length > 100) {
      this.data.telegramLogs = this.data.telegramLogs.slice(0, 100);
    }
    // Alert history is not critical state; coalesce bursts of alerts into one write.
    this.scheduleSave();
  }

  public clearTelegramLogs(): void {
    this.data.telegramLogs = [];
    this.save();
  }
}

export const db = new Database();
