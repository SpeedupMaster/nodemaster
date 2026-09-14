import fs from "fs";
import path from "path";
import { NodeItem, RelayLink, SubscriptionToken, SystemConfig } from "../types/index.js";
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
    name: "HK-BGP-Reality-01",
    ip: "103.145.75.22",
    port: 443,
    type: "exit",
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
    tags: ["香港", "原生IP", "流媒体解锁"],
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
    id: "node-us-02",
    name: "US-LAX-AI-Ready",
    ip: "154.23.189.90",
    port: 443,
    type: "exit",
    protocol: "vless-reality",
    status: "online",
    country: "US",
    countryName: "美国洛杉矶",
    token: "token_us_8848",
    trafficUsedBytes: 429496729600, // ~400 GB
    trafficLimitBytes: 2147483648000, // 2 TB
    uplinkSpeedBytes: 340000,
    downlinkSpeedBytes: 1820000,
    cpuUsage: 9.8,
    memUsage: 22.4,
    diskUsage: 41.0,
    latencyMs: 145,
    tags: ["美国", "OpenAI/Claude专线", "超大带宽"],
    reality: {
      uuid: "7b2c9182-3d4e-5f60-7a8b-9c0d1e2f3a4b",
      flow: "xtls-rprx-vision",
      serverName: "www.apple.com",
      publicKey: "pX9q42Lm7n8kYm12Zp3wXq4Rt5Y6u7I8o9P0a1S2d3C",
      privateKey: "1JLBx1ZqLf8JixE5KQDdLqyqy9RXsGCksrkitpNkeVh",
      shortId: "fa5c1c0e44d65fa5",
      fingerprint: "safari",
      dest: "www.apple.com:443"
    },
    lastSeen: Date.now(),
    createdAt: Date.now() - 86400000 * 20
  },
  {
    id: "node-jp-03",
    name: "JP-TYO-Premium",
    ip: "198.13.44.112",
    port: 443,
    type: "exit",
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
    tags: ["日本", "软银线路", "Netflix解锁"],
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
    id: "node-cn-transit-01",
    name: "CN-GZ-BGP-中转入口",
    ip: "120.232.18.99",
    port: 10443,
    type: "transit",
    protocol: "dokodemo",
    status: "online",
    country: "CN",
    countryName: "中国广州 (BGP入口)",
    token: "token_cn_transit_8848",
    trafficUsedBytes: 250000000000,
    trafficLimitBytes: 3221225472000, // 3 TB
    uplinkSpeedBytes: 4200000,
    downlinkSpeedBytes: 4180000,
    cpuUsage: 25.1,
    memUsage: 19.8,
    diskUsage: 22.0,
    latencyMs: 12,
    tags: ["国内入口", "三网优化", "低延迟转发"],
    lastSeen: Date.now(),
    createdAt: Date.now() - 86400000 * 8
  }
];

const INITIAL_RELAYS: RelayLink[] = [
  {
    id: "relay-gz-hk",
    name: "广港专线 (广州BGP → 香港01)",
    transitNodeId: "node-cn-transit-01",
    exitNodeId: "node-hk-01",
    transitPort: 10443,
    status: "active",
    trafficBytes: 154800000000,
    latencyMs: 22,
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
}

export const db = new Database();
