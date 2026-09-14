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
