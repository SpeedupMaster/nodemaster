import fs from "fs";
import path from "path";
import { NodeItem, RelayLink, SubscriptionToken, SystemConfig, LatencyTask, NodeLatencyHistory, RoutingRule } from "../types/index.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "nodemaster_db.json");

export interface DatabaseSchema {
  nodes: NodeItem[];
  relays: RelayLink[];
  subscriptions: SubscriptionToken[];
  config: SystemConfig;
  latencyTasks: LatencyTask[];
  routingRules: RoutingRule[];
}

const DEFAULT_CONFIG: SystemConfig = {
  port: 3880,
  host: "0.0.0.0",
  jwtSecret: "nm_secret_key_8848_secure",
  panelUrl: "http://127.0.0.1:3880",
  autoCircuitBreaker: true,
  circuitBreakerThresholdPct: 98,
  trafficResetDay: 1,
};

const INITIAL_NODES: NodeItem[] = [
  {
    id: "node-hk-01",
    name: "HK-BGP-Direct-01",
    ip: "103.145.75.22",
    port: 443,
    type: "direct",
    protocol: "vless-reality",
    status: "online",
    country: "HK",
    countryName: "中国香港",
    token: "token_hk_8848",
    trafficUsedBytes: 184520394800, // ~171 GB
    trafficLimitBytes: 1073741824000, // 1 TB
    uplinkSpeedBytes: 1250000, // 1.2 MB/s
    downlinkSpeedBytes: 4890000, // 4.8 MB/s
    cpuUsage: 14.5,
    memUsage: 28.2,
    diskUsage: 35.1,
    latencyMs: 38,
    tags: ["香港", "主力直连", "低延迟BGP", "千兆带宽"],
    bandwidthMbps: 1000,
    trafficResetDay: 1,
    costAmount: 38,
    costCurrency: "CNY",
    costPeriod: "monthly",
    expiresAt: "2026-11-15",
    autoRenew: true,
    os: "Debian 12.5 (bookworm)",
    arch: "x86_64",
    uptime: "28天 14小时",
    loadAvg: [0.15, 0.22, 0.18],
    memTotalBytes: 2147483648,
    memUsedBytes: 605552640,
    diskTotalBytes: 42949672960,
    diskUsedBytes: 15073280000,
    tcpCount: 124,
    udpCount: 16,
    reality: {
      uuid: "3d5f470a-7e3e-4b6e-8d5c-9d6cfba61a91",
      flow: "xtls-rprx-vision",
      serverName: "www.microsoft.com",
      publicKey: "kM9f83Kk4r7lYm89Zp0wXq5Rt6Y7u8I9o0P1a2S3d4E",
      privateKey: "0HYBx0ZqLf7JixE4KQDdLqyqy8RXsGCksrkitpNkeVg",
      shortId: "e44d6fa55fa5c1c0",
      fingerprint: "chrome",
      dest: "www.microsoft.com:443"
    },
    lastSeen: Date.now(),
    createdAt: Date.now() - 86400000 * 15
  },
  {
    id: "node-jp-02",
    name: "JP-TYO-Direct-02",
    ip: "198.13.44.112",
    port: 443,
    type: "direct",
    protocol: "vless-reality",
    status: "online",
    country: "JP",
    countryName: "日本东京",
    token: "token_jp_8848",
    trafficUsedBytes: 312000000000, // ~290 GB
    trafficLimitBytes: 1073741824000, // 1 TB
    uplinkSpeedBytes: 890000,
    downlinkSpeedBytes: 3450000,
    cpuUsage: 18.2,
    memUsage: 31.0,
    diskUsage: 29.5,
    latencyMs: 65,
    tags: ["日本", "软银直连", "主力大带宽", "双向CN2"],
    bandwidthMbps: 1000,
    trafficResetDay: 1,
    costAmount: 5.5,
    costCurrency: "USD",
    costPeriod: "monthly",
    expiresAt: "2026-10-28",
    autoRenew: false,
    os: "Ubuntu 22.04.4 LTS",
    arch: "x86_64",
    uptime: "42天 8小时",
    loadAvg: [0.42, 0.51, 0.45],
    memTotalBytes: 4294967296,
    memUsedBytes: 1331439861,
    diskTotalBytes: 64424509440,
    diskUsedBytes: 19005230284,
    tcpCount: 218,
    udpCount: 34,
    reality: {
      uuid: "5e8d9c12-3a4b-5c6d-7e8f-9a0b1c2d3e4f",
      flow: "xtls-rprx-vision",
      serverName: "addons.mozilla.org",
      publicKey: "rY8z53Nn9o0lZn23Aq4xYr5Su6Z7v8J9p0Q1b2T3e4D",
      privateKey: "2KMCx2ArMg9KjyF6LREeMrzrz0SYtHDltrliuQOleWi",
      shortId: "6fa55fa5c1c0e44d",
      fingerprint: "firefox",
      dest: "addons.mozilla.org:443"
    },
    lastSeen: Date.now(),
    createdAt: Date.now() - 86400000 * 10
  },
  {
    id: "node-us-unlock-01",
    name: "US-Residential-Unlock-01",
    ip: "154.23.189.90",
    port: 8388,
    type: "unlock",
    protocol: "shadowsocks",
    status: "online",
    country: "US",
    countryName: "美国洛杉矶 (原生住宅)",
    token: "token_us_unlock_8848",
    trafficUsedBytes: 129496729600, // ~120 GB
    trafficLimitBytes: 2147483648000, // 2 TB
    uplinkSpeedBytes: 340000,
    downlinkSpeedBytes: 1820000,
    cpuUsage: 9.8,
    memUsage: 22.4,
    diskUsage: 41.0,
    latencyMs: 145,
    tags: ["美国家宽", "原生双ISP", "Shadowsocks", "OpenAI/流媒体全解锁"],
    bandwidthMbps: 500,
    trafficResetDay: 15,
    costAmount: 18,
    costCurrency: "USD",
    costPeriod: "quarterly",
    expiresAt: "2026-12-01",
    autoRenew: true,
    os: "Debian 12.5 (bookworm)",
    arch: "x86_64",
    uptime: "15天 2小时",
    loadAvg: [0.08, 0.12, 0.10],
    memTotalBytes: 1073741824,
    memUsedBytes: 240518144,
    diskTotalBytes: 26843545600,
    diskUsedBytes: 11005853696,
    tcpCount: 88,
    udpCount: 12,
    shadowsocks: {
      method: "2022-blake3-aes-128-gcm",
      password: "u0J9xK1L2m3N4o5P6q7R8s=="
    },
    lastSeen: Date.now(),
    createdAt: Date.now() - 86400000 * 20
  },
  {
    id: "node-uk-unlock-02",
    name: "UK-London-Unlock-02",
    ip: "185.220.101.55",
    port: 8388,
    type: "unlock",
    protocol: "shadowsocks",
    status: "online",
    country: "GB",
    countryName: "英国伦敦 (原生IP)",
    token: "token_uk_unlock_8848",
    trafficUsedBytes: 85200000000,
    trafficLimitBytes: 1073741824000, // 1 TB
    uplinkSpeedBytes: 210000,
    downlinkSpeedBytes: 1150000,
    cpuUsage: 8.5,
    memUsage: 19.0,
    diskUsage: 25.0,
    latencyMs: 180,
    tags: ["英国原生", "Shadowsocks", "BBC iPlayer", "全流媒体解锁"],
    bandwidthMbps: 500,
    trafficResetDay: 28,
    costAmount: 45,
    costCurrency: "EUR",
    costPeriod: "annually",
    expiresAt: "2027-03-20",
    autoRenew: false,
    os: "Alpine Linux 3.19",
    arch: "aarch64",
    uptime: "33天 19小时",
    loadAvg: [0.18, 0.16, 0.14],
    memTotalBytes: 2147483648,
    memUsedBytes: 408021893,
    diskTotalBytes: 34359738368,
    diskUsedBytes: 8589934592,
    tcpCount: 96,
    udpCount: 14,
    shadowsocks: {
      method: "2022-blake3-aes-128-gcm",
      password: "v1K0yL2M3n4O5p6Q7r8S9t=="
    },
    lastSeen: Date.now(),
    createdAt: Date.now() - 86400000 * 8
  }
];

const INITIAL_RELAYS: RelayLink[] = [
  {
    id: "relay-hk-us-ai",
    name: "港美链式解锁 (香港主力 ➔ 美国家宽 AI/流媒体)",
    mainNodeId: "node-hk-01",
    unlockNodeId: "node-us-unlock-01",
    mode: "ai_media",
    transitNodeId: "node-hk-01",
    exitNodeId: "node-us-unlock-01",
    transitPort: 443,
    status: "active",
    trafficBytes: 85400000000,
    latencyMs: 142,
    createdAt: Date.now() - 86400000 * 7
  }
];

const INITIAL_SUBSCRIPTIONS: SubscriptionToken[] = [
  {
    id: "sub-default",
    name: "默认全量节点订阅",
    token: "nodemaster_universal_sub_token_7788",
    nodeIds: [], // 全部节点
    trafficLimitBytes: 0, // 无限制
    trafficUsedBytes: 674520394800,
    expireAt: 0,
    createdAt: Date.now() - 86400000 * 14
  }
];

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

const TASK_DEFAULT_COLORS: Record<string, string> = {
  "广东移动": "#ef4444",
  "广东联通": "#22c55e",
  "广东电信": "#6366f1",
  "湖北移动": "#06b6d4",
  "湖北联通": "#38bdf8",
  "湖北电信": "#a855f7",
  "四川移动": "#f97316",
  "四川联通": "#eab308",
  "四川电信": "#ec4899",
};

const FALLBACK_PALETTE = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f43f5e",
  "#14b8a6", "#f59e0b", "#06b6d4", "#64748b"
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

class Database {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        this.data = JSON.parse(raw);
        let changed = false;
        if (!this.data.latencyTasks || this.data.latencyTasks.length === 0) {
          this.data.latencyTasks = [...INITIAL_LATENCY_TASKS];
          changed = true;
        }
        if (!this.data.routingRules || this.data.routingRules.length === 0) {
          this.data.routingRules = JSON.parse(JSON.stringify(INITIAL_ROUTING_RULES));
          changed = true;
        }
        if (changed) {
          this.save();
        }
      } catch (err) {
        console.error("[Database] Corrupt DB file, initializing defaults", err);
        this.data = this.createDefault();
        this.save();
      }
    } else {
      this.data = this.createDefault();
      this.save();
    }
  }

  private createDefault(): DatabaseSchema {
    return {
      nodes: INITIAL_NODES,
      relays: INITIAL_RELAYS,
      subscriptions: INITIAL_SUBSCRIPTIONS,
      config: DEFAULT_CONFIG,
      latencyTasks: [...INITIAL_LATENCY_TASKS],
      routingRules: JSON.parse(JSON.stringify(INITIAL_ROUTING_RULES)),
    };
  }

  private save() {
    const tmp = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf-8");
    fs.renameSync(tmp, DATA_FILE);
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

  public updateNode(id: string, updates: Partial<NodeItem>): NodeItem | null {
    const idx = this.data.nodes.findIndex(n => n.id === id);
    if (idx === -1) return null;
    this.data.nodes[idx] = { ...this.data.nodes[idx], ...updates };
    this.save();
    return this.data.nodes[idx];
  }

  public deleteNode(id: string): boolean {
    const before = this.data.nodes.length;
    this.data.nodes = this.data.nodes.filter(n => n.id !== id);
    this.data.relays = this.data.relays.filter(r => r.transitNodeId !== id && r.exitNodeId !== id);
    this.save();
    return this.data.nodes.length < before;
  }

  // Relays API
  public getRelays(): RelayLink[] {
    return this.data.relays;
  }

  public addRelay(relay: RelayLink): RelayLink {
    this.data.relays.push(relay);
    this.save();
    return relay;
  }

  public deleteRelay(id: string): boolean {
    const before = this.data.relays.length;
    this.data.relays = this.data.relays.filter(r => r.id !== id);
    this.save();
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

  public deleteSubscription(id: string): boolean {
    const before = this.data.subscriptions.length;
    this.data.subscriptions = this.data.subscriptions.filter(s => s.id !== id);
    this.save();
    return this.data.subscriptions.length < before;
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
    return this.data.latencyTasks || [];
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
    this.data.latencyTasks = [...INITIAL_LATENCY_TASKS];
    this.save();
    return this.data.latencyTasks;
  }

  // Node Latency History Simulator / Provider
  public getNodeLatencyHistory(nodeId: string, range = "1h"): NodeLatencyHistory[] {
    const node = this.getNodeById(nodeId);
    if (!node) return [];

    const tasks = (this.data.latencyTasks || []).filter(
      t => t.enabled && (t.nodeIds.length === 0 || t.nodeIds.includes(nodeId))
    );

    let pointsCount = 60;
    let stepMs = 60 * 1000;
    if (range === "6h") {
      pointsCount = 72;
      stepMs = 5 * 60 * 1000;
    } else if (range === "12h") {
      pointsCount = 72;
      stepMs = 10 * 60 * 1000;
    } else if (range === "1d") {
      pointsCount = 96;
      stepMs = 15 * 60 * 1000;
    } else if (range === "3d") {
      pointsCount = 108;
      stepMs = 40 * 60 * 1000;
    } else if (range === "7d") {
      pointsCount = 112;
      stepMs = 90 * 60 * 1000;
    }

    const now = Date.now();
    const startTime = now - pointsCount * stepMs;

    let nodeBase = node.latencyMs || 45;
    if (node.country === "HK") nodeBase = 18;
    else if (node.country === "JP") nodeBase = 58;
    else if (node.country === "US") nodeBase = 145;

    return tasks.map((task, tIdx) => {
      let targetOffset = 0;
      if (task.name.includes("广东")) targetOffset = 0;
      else if (task.name.includes("湖北")) targetOffset = 15;
      else if (task.name.includes("四川")) targetOffset = 25;
      else targetOffset = 10;

      if (task.name.includes("电信")) targetOffset -= 2;
      else if (task.name.includes("联通")) targetOffset += 1;
      else if (task.name.includes("移动")) targetOffset += 3;

      const base = Math.max(10, nodeBase + targetOffset);
      const color = TASK_DEFAULT_COLORS[task.name] || FALLBACK_PALETTE[tIdx % FALLBACK_PALETTE.length];

      const history = [];
      for (let i = 0; i < pointsCount; i++) {
        const time = startTime + i * stepMs;
        const wave = Math.sin((i / pointsCount) * Math.PI * 4 + tIdx) * 3;
        const noise = Math.sin(i * 13 + tIdx * 7) * 1.5;
        const spike = (i % 23 === 0) ? 4.5 : 0;
        const lat = +(base + wave + noise + spike).toFixed(1);
        history.push({
          timestamp: time,
          latencyMs: Math.max(5, lat),
          lossRate: 0.0,
          jitter: +(Math.abs(noise * 0.6) + 0.3).toFixed(1),
        });
      }

      const latest = history[history.length - 1];
      return {
        nodeId,
        taskId: task.id,
        taskName: task.name,
        color,
        currentLatency: latest.latencyMs,
        lossRate: 0.0,
        jitter: latest.jitter,
        history,
      };
    });
  }

  // Node Hardware Load History Simulator
  public getNodeLoadHistory(nodeId: string, range = "1h") {
    const node = this.getNodeById(nodeId);
    if (!node) return null;

    let pointsCount = 60;
    let stepMs = 60 * 1000;
    if (range === "6h") {
      pointsCount = 72;
      stepMs = 5 * 60 * 1000;
    } else if (range === "12h") {
      pointsCount = 72;
      stepMs = 10 * 60 * 1000;
    } else if (range === "1d") {
      pointsCount = 96;
      stepMs = 15 * 60 * 1000;
    } else if (range === "3d") {
      pointsCount = 108;
      stepMs = 40 * 60 * 1000;
    } else if (range === "7d") {
      pointsCount = 112;
      stepMs = 90 * 60 * 1000;
    }

    const now = Date.now();
    const startTime = now - pointsCount * stepMs;

    const timestamps: number[] = [];
    const cpu: number[] = [];
    const mem: number[] = [];
    const disk: number[] = [];
    const netIn: number[] = [];
    const netOut: number[] = [];

    const baseCpu = node.cpuUsage || 15;
    const baseMem = node.memUsage || 25;
    const baseDisk = node.diskUsage || 30;

    for (let i = 0; i < pointsCount; i++) {
      const t = startTime + i * stepMs;
      timestamps.push(t);
      const cpuWave = Math.sin((i / pointsCount) * Math.PI * 6) * 6 + (Math.sin(i * 17) * 3);
      cpu.push(+(Math.min(99, Math.max(2, baseCpu + cpuWave))).toFixed(1));
      const memWave = Math.sin((i / pointsCount) * Math.PI * 2) * 2 + (Math.sin(i * 7) * 1);
      mem.push(+(Math.min(99, Math.max(5, baseMem + memWave))).toFixed(1));
      disk.push(+baseDisk.toFixed(1));
      const speedIn = Math.max(50, (node.downlinkSpeedBytes || 204800) + Math.sin(i * 5) * 80000);
      const speedOut = Math.max(20, (node.uplinkSpeedBytes || 81920) + Math.sin(i * 3) * 30000);
      netIn.push(Math.round(speedIn));
      netOut.push(Math.round(speedOut));
    }

    return {
      timestamps,
      cpu,
      mem,
      disk,
      netIn,
      netOut,
    };
  }

  // Routing Rules API
  public getRoutingRules(): RoutingRule[] {
    if (!this.data.routingRules || this.data.routingRules.length === 0) {
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
    this.save();
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
    this.save();
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
    this.save();
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
    this.save();
    return this.getRoutingRules();
  }

  public resetRoutingRules(): RoutingRule[] {
    this.data.routingRules = JSON.parse(JSON.stringify(INITIAL_ROUTING_RULES));
    this.save();
    return this.getRoutingRules();
  }
}

export const db = new Database();
