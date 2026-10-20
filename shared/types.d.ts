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

export type NodeProtocol = "vless-reality" | "shadowsocks";

export interface NodeItem {
  id: string;
  name: string;
  ip: string;
  port: number;
  // Role in the topology; always "unlock" for shadowsocks and "direct" for vless-reality nodes
  type: "direct" | "unlock";
  protocol: NodeProtocol;
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
  bandwidthMbps?: number;
  trafficResetDay?: number;
  costAmount?: number;
  costCurrency?: "CNY" | "USD" | "EUR";
  costPeriod?: "monthly" | "quarterly" | "annually";
  expiresAt?: string;
  autoRenew?: boolean;
  // Probe & System Telemetry
  os?: string;
  arch?: string;
  uptime?: string;
  loadAvg?: [number, number, number];
  memTotalBytes?: number;
  memUsedBytes?: number;
  diskTotalBytes?: number;
  diskUsedBytes?: number;
  tcpCount?: number;
  udpCount?: number;
  xrayVersion?: string;
  tcpCongestion?: string;
  trafficPeriodStart?: number;
  agentSchemaVersion?: number;
  telemetryBootId?: string;
  telemetrySequence?: number;
  networkRxBytes?: number;
  networkTxBytes?: number;
  desiredXrayVersion?: string;
  upgradeStatus?: "pending" | "failed" | "succeeded";
  upgradeError?: string;
  // Dynamic Hot Sync
  configVersion?: number;
  appliedConfigVersion?: number;
  configSyncStatus?: "synced" | "pending" | "failed";
  configSyncError?: string;
  configSyncedAt?: number;
}

/** Editable node fields accepted by POST /api/nodes and PUT /api/nodes/:id. */
export interface NodeInput {
  name?: string;
  ip?: string;
  port?: number;
  protocol?: NodeProtocol;
  country?: string;
  countryName?: string;
  trafficLimitBytes?: number;
  bandwidthMbps?: number;
  trafficResetDay?: number;
  costAmount?: number | null;
  costCurrency?: NodeItem["costCurrency"];
  costPeriod?: NodeItem["costPeriod"];
  expiresAt?: string | null;
  autoRenew?: boolean;
  tags?: string[];
  sni?: string;
  shadowsocks?: Partial<ShadowsocksConfig>;
}

export interface XrayVersionNodeStatus {
  desiredVersion?: string;
  upgradeStatus?: "pending" | "failed" | "succeeded";
  upgradeError?: string;
  nodeId: string;
  nodeName: string;
  currentVersion?: string;
  status: "up_to_date" | "outdated" | "unknown";
  arch?: string;
  os?: string;
}

export interface XrayVersionInfo {
  latestVersion: string;
  releaseUrl: string;
  publishedAt: string;
  checkedAt: number;
  nodes: XrayVersionNodeStatus[];
}

export interface RelayLink {
  id: string;
  name: string;
  mainNodeId: string;
  unlockNodeId: string;
  mode?: "ai_media" | "all" | "custom";
  customServices?: string[];
  customDomains?: string[];
  // Dedicated VLESS client on the main node: the 🔗 subscription entry authenticates with it,
  // letting the server tell chained traffic apart from the plain direct entry
  chainUuid: string;
  status: "active" | "inactive";
  createdAt: number;
}

export interface SubscriptionToken {
  id: string;
  name: string;
  token: string;
  nodeIds: string[];
  /** Unix seconds; 0 = never expires */
  expireAt: number;
  createdAt: number;
  customHost?: string;
}

export interface SystemConfig {
  jwtSecret: string;
  autoCircuitBreaker: boolean;
  circuitBreakerThresholdPct: number;
  trafficResetDay: number;
}

export interface LatencyTask {
  id: string;
  name: string;
  target: string;
  type: "tcp" | "icmp";
  intervalSec: number;
  nodeIds: string[]; // empty array means all nodes
  enabled: boolean;
  order: number;
}

export interface LatencyPoint {
  timestamp: number;
  latencyMs: number;
  lossRate: number;
  jitter: number;
}

export interface NodeLatencyHistory {
  nodeId: string;
  taskId: string;
  taskName: string;
  currentLatency: number;
  lossRate: number;
  jitter: number;
  history: LatencyPoint[];
}

export interface RoutingRule {
  id: string;
  name: string;
  targetOutbound: "DIRECT" | "BLOCK" | "UNLOCK_OUT" | "PROXY";
  domains?: string[];
  geosite?: string[];
  ips?: string[];
  geoip?: string[];
  protocol?: string[];
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  apiEndpoint?: string;
  offlineAlert: boolean;
  trafficAlert: boolean;
  trafficThresholdPercent: number;
  renewalAlert: boolean;
  renewalDaysAhead: number;
  cpuAlert: boolean;
  cpuThresholdPercent: number;
  memAlert: boolean;
  memThresholdPercent: number;
}

export type TelegramAlertType = "offline" | "recovery" | "traffic" | "renewal" | "cpu" | "mem" | "test";

export interface TelegramAlertLog {
  id: string;
  type: TelegramAlertType;
  nodeId?: string;
  nodeName?: string;
  title: string;
  message: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

// -------------------------------------------------------------
// Traffic analytics (measured NIC counters only; no per-service breakdown is collected)
// -------------------------------------------------------------
export type TrafficRange = "today" | "7d" | "30d" | "month" | "all";

export interface NodeTrafficDistribution {
  nodeId: string;
  nodeName: string;
  country: string;
  countryName: string;
  totalBytes: number;
  percentage: number;
}

export interface TrafficTimeSeriesPoint {
  /** Bucket start (hourly for "today", daily otherwise); format on the client in its own timezone */
  timestamp: number;
  totalBytes: number;
}

export interface TrafficAnalyticsSummary {
  timeRange: TrafficRange;
  totalRecordedBytes: number;
  totalUplinkBytes: number;
  totalDownlinkBytes: number;
  nodeDistributions: NodeTrafficDistribution[];
  timeSeries: TrafficTimeSeriesPoint[];
  updatedAt: number;
}

export interface ApiResult<T> { success: boolean; data?: T; message?: string; code?: string }
export interface AdminProfile { username: string; updatedAt?: number }
