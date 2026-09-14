export interface XrayRealityConfig {
  uuid: string;
  flow: string;
  serverName: string;
  publicKey: string;
  privateKey: string;
  shortId: string;
  fingerprint: string;
  dest: string;
}

export interface ShadowsocksConfig {
  method: string;
  password: string;
}

export interface NodeItem {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: "direct" | "unlock" | "transit" | "exit";
  protocol: "vless-reality" | "shadowsocks" | "trojan" | "dokodemo" | "socks5";
  status: "online" | "offline" | "circuit_broken";
  country: string;
  countryName: string;
  token: string;
  trafficUsedBytes: number;
  trafficLimitBytes: number;
  uplinkSpeedBytes: number;
  downlinkSpeedBytes: number;
  cpuUsage: number;
  memUsage: number;
  diskUsage: number;
  latencyMs: number;
  reality?: XrayRealityConfig;
  shadowsocks?: ShadowsocksConfig;
  lastSeen: number;
  createdAt: number;
  tags: string[];
  sni?: string;
}

export interface RelayLink {
  id: string;
  name: string;
  mainNodeId: string;
  unlockNodeId: string;
  mode?: "ai_media" | "all";
  transitNodeId?: string;
  exitNodeId?: string;
  transitPort?: number;
  status: "active" | "inactive";
  trafficBytes: number;
  latencyMs: number;
  createdAt: number;
}

export interface SubscriptionToken {
  id: string;
  name: string;
  token: string;
  nodeIds: string[];
  trafficLimitBytes: number;
  trafficUsedBytes: number;
  expireAt: number;
  createdAt: number;
}
