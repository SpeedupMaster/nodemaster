import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'nodemaster_db.json');
const HISTORY_FILE = path.join(DATA_DIR, 'telemetry-history.json');

const GB = 1024 ** 3;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function billingPeriod(now, resetDay = 1) {
  const date = new Date(now);
  const boundary = (year, month) => {
    const day = Math.min(Math.max(1, resetDay), new Date(year, month + 1, 0).getDate());
    return new Date(year, month, day).getTime();
  };
  const current = boundary(date.getFullYear(), date.getMonth());
  return now >= current ? current : boundary(date.getFullYear(), date.getMonth() - 1);
}

function generateRealityCredentials(serverName = 'www.apple.com') {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519');
  return {
    uuid: crypto.randomUUID(),
    flow: 'xtls-rprx-vision',
    serverName,
    publicKey: publicKey.export({ format: 'jwk' }).x,
    privateKey: privateKey.export({ format: 'jwk' }).d,
    shortId: crypto.randomBytes(8).toString('hex'),
    fingerprint: 'chrome',
    dest: `${serverName}:443`,
  };
}

function generateShadowsocksCredentials() {
  const length = 16; // 2022-blake3-aes-128-gcm
  return {
    method: '2022-blake3-aes-128-gcm',
    password: crypto.randomBytes(length).toString('base64'),
  };
}

const now = Date.now();
// Setting lastSeen in the far future ensures demo nodes stay online without an active probe daemon
const futureSeen = now + 10 * 365 * DAY;

// Load existing DB to preserve admin credentials and jwtSecret
let existingDb = {};
if (fs.existsSync(DB_FILE)) {
  try {
    existingDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (err) {
    console.error('Failed to parse existing DB, using fallback');
  }
}

const jwtSecret = existingDb.config?.jwtSecret || crypto.randomBytes(48).toString('base64url');
const admin = existingDb.admin || {
  username: 'admin',
  passwordHash: '1d4d3b0f877002a7e00f23a22441059f6d6f490fdefa9260d1b8ba837db1c5fb93445ac2194cdc76e0cfb0686c37dee7b5a5bdc5e77e90c78b4a9598ccf0caed',
  salt: '00f317b063e57c951fb06bf23375df71',
  sessionVersion: crypto.randomUUID(),
  updatedAt: now,
};

const nodes = [
  {
    id: 'node-hk-01',
    name: '🇭🇰 香港 CN2 GIA · 极速专线',
    ip: '45.154.12.88',
    port: 443,
    type: 'direct',
    protocol: 'vless-reality',
    status: 'online',
    country: 'HK',
    countryName: '中国香港',
    token: 'tok_hk_01_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(4.82 * 1024 * GB),
    trafficLimitBytes: 10 * 1024 * GB,
    uplinkSpeedBytes: 4.8 * 1024 * 1024,
    downlinkSpeedBytes: 21.6 * 1024 * 1024,
    cpuUsage: 23.4,
    memUsage: 41.2,
    diskUsage: 32.5,
    latencyMs: 18,
    bandwidthMbps: 1000,
    trafficResetDay: 1,
    costAmount: 168,
    costCurrency: 'CNY',
    costPeriod: 'monthly',
    expiresAt: '2026-12-31',
    autoRenew: true,
    tags: ['CN2 GIA', '低延迟', '4K流媒体', '千兆BGP'],
    reality: generateRealityCredentials('www.apple.com'),
    lastSeen: futureSeen,
    createdAt: now - 90 * DAY,
    os: 'Debian 12 (bookworm)',
    arch: 'x86_64',
    uptime: '148天 12小时',
    loadAvg: [0.35, 0.42, 0.38],
    memTotalBytes: 4 * 1024 * GB,
    memUsedBytes: Math.floor(1.65 * 1024 * GB),
    diskTotalBytes: 80 * GB,
    diskUsedBytes: Math.floor(26 * GB),
    tcpCount: 342,
    udpCount: 86,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 1,
    appliedConfigVersion: 1,
  },
  {
    id: 'node-jp-01',
    name: '🇯🇵 东京 BGP · 软银金融专线',
    ip: '103.214.88.25',
    port: 443,
    type: 'direct',
    protocol: 'vless-reality',
    status: 'online',
    country: 'JP',
    countryName: '日本东京',
    token: 'tok_jp_01_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(2.74 * 1024 * GB),
    trafficLimitBytes: 6 * 1024 * GB,
    uplinkSpeedBytes: 2.3 * 1024 * 1024,
    downlinkSpeedBytes: 11.2 * 1024 * 1024,
    cpuUsage: 17.8,
    memUsage: 35.6,
    diskUsage: 24.1,
    latencyMs: 36,
    bandwidthMbps: 1000,
    trafficResetDay: 1,
    costAmount: 120,
    costCurrency: 'CNY',
    costPeriod: 'monthly',
    expiresAt: '2026-11-20',
    autoRenew: true,
    tags: ['BBTEC 软银', '东京多线', 'Xray-Reality', '低抖动'],
    reality: generateRealityCredentials('www.microsoft.com'),
    lastSeen: futureSeen,
    createdAt: now - 80 * DAY,
    os: 'Ubuntu 22.04.4 LTS',
    arch: 'x86_64',
    uptime: '89天 6小时',
    loadAvg: [0.22, 0.28, 0.25],
    memTotalBytes: 4 * 1024 * GB,
    memUsedBytes: Math.floor(1.42 * 1024 * GB),
    diskTotalBytes: 60 * GB,
    diskUsedBytes: Math.floor(14.5 * GB),
    tcpCount: 215,
    udpCount: 42,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 1,
    appliedConfigVersion: 1,
  },
  {
    id: 'node-sg-01',
    name: '🇸🇬 新加坡 · 亚太骨干枢纽',
    ip: '139.180.201.76',
    port: 8443,
    type: 'direct',
    protocol: 'vless-reality',
    status: 'online',
    country: 'SG',
    countryName: '新加坡',
    token: 'tok_sg_01_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(3.91 * 1024 * GB),
    trafficLimitBytes: 8 * 1024 * GB,
    uplinkSpeedBytes: 6.2 * 1024 * 1024,
    downlinkSpeedBytes: 28.4 * 1024 * 1024,
    cpuUsage: 31.2,
    memUsage: 53.4,
    diskUsage: 45.2,
    latencyMs: 52,
    bandwidthMbps: 2500,
    trafficResetDay: 1,
    costAmount: 220,
    costCurrency: 'CNY',
    costPeriod: 'monthly',
    expiresAt: '2027-03-15',
    autoRenew: true,
    tags: ['亚太骨干', '2.5G端口', '自适应中转', '国际互联'],
    reality: generateRealityCredentials('gateway.icloud.com'),
    lastSeen: futureSeen,
    createdAt: now - 120 * DAY,
    os: 'Debian 12 (bookworm)',
    arch: 'x86_64',
    uptime: '210天 18小时',
    loadAvg: [0.65, 0.58, 0.52],
    memTotalBytes: 8 * 1024 * GB,
    memUsedBytes: Math.floor(4.27 * 1024 * GB),
    diskTotalBytes: 120 * GB,
    diskUsedBytes: Math.floor(54.2 * GB),
    tcpCount: 480,
    udpCount: 110,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 1,
    appliedConfigVersion: 1,
  },
  {
    id: 'node-us-01',
    name: '🇺🇸 洛杉矶 AS9929 · 美西优化',
    ip: '23.94.108.19',
    port: 443,
    type: 'direct',
    protocol: 'vless-reality',
    status: 'online',
    country: 'US',
    countryName: '美国洛杉矶',
    token: 'tok_us_01_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(8.42 * 1024 * GB),
    trafficLimitBytes: 15 * 1024 * GB,
    uplinkSpeedBytes: 3.8 * 1024 * 1024,
    downlinkSpeedBytes: 15.6 * 1024 * 1024,
    cpuUsage: 22.4,
    memUsage: 38.8,
    diskUsage: 28.7,
    latencyMs: 132,
    bandwidthMbps: 1000,
    trafficResetDay: 1,
    costAmount: 99,
    costCurrency: 'USD',
    costPeriod: 'annually',
    expiresAt: '2027-01-01',
    autoRenew: true,
    tags: ['AS9929 联通A网', '美西精品', '大带宽', '高防'],
    reality: generateRealityCredentials('aws.amazon.com'),
    lastSeen: futureSeen,
    createdAt: now - 160 * DAY,
    os: 'AlmaLinux 9.4',
    arch: 'x86_64',
    uptime: '164天 4小时',
    loadAvg: [0.38, 0.40, 0.35],
    memTotalBytes: 4 * 1024 * GB,
    memUsedBytes: Math.floor(1.55 * 1024 * GB),
    diskTotalBytes: 100 * GB,
    diskUsedBytes: Math.floor(28.7 * GB),
    tcpCount: 290,
    udpCount: 64,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 1,
    appliedConfigVersion: 1,
  },
  {
    id: 'node-de-01',
    name: '🇩🇪 法兰克福 · 欧洲核心互联',
    ip: '185.242.115.42',
    port: 443,
    type: 'direct',
    protocol: 'vless-reality',
    status: 'online',
    country: 'DE',
    countryName: '德国法兰克福',
    token: 'tok_de_01_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(1.84 * 1024 * GB),
    trafficLimitBytes: 10 * 1024 * GB,
    uplinkSpeedBytes: 0.9 * 1024 * 1024,
    downlinkSpeedBytes: 3.8 * 1024 * 1024,
    cpuUsage: 12.5,
    memUsage: 28.3,
    diskUsage: 19.5,
    latencyMs: 168,
    bandwidthMbps: 1000,
    trafficResetDay: 1,
    costAmount: 48,
    costCurrency: 'EUR',
    costPeriod: 'annually',
    expiresAt: '2027-05-30',
    autoRenew: true,
    tags: ['欧洲核心', 'DE-CIX', '万兆汇聚', '隐私保护'],
    reality: generateRealityCredentials('www.cloudflare.com'),
    lastSeen: futureSeen,
    createdAt: now - 75 * DAY,
    os: 'Debian 12 (bookworm)',
    arch: 'x86_64',
    uptime: '75天 11小时',
    loadAvg: [0.15, 0.18, 0.16],
    memTotalBytes: 4 * 1024 * GB,
    memUsedBytes: Math.floor(1.13 * 1024 * GB),
    diskTotalBytes: 50 * GB,
    diskUsedBytes: Math.floor(9.8 * GB),
    tcpCount: 120,
    udpCount: 28,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 1,
    appliedConfigVersion: 1,
  },
  {
    id: 'node-sg-unlock',
    name: '🇸🇬 狮城原生 · 4K流媒体解锁',
    ip: '165.22.98.140',
    port: 8388,
    type: 'unlock',
    protocol: 'shadowsocks',
    status: 'online',
    country: 'SG',
    countryName: '新加坡原生住宅',
    token: 'tok_sg_un_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(780 * GB),
    trafficLimitBytes: 3 * 1024 * GB,
    uplinkSpeedBytes: 1.4 * 1024 * 1024,
    downlinkSpeedBytes: 7.2 * 1024 * 1024,
    cpuUsage: 15.6,
    memUsage: 24.3,
    diskUsage: 18.0,
    latencyMs: 58,
    bandwidthMbps: 500,
    trafficResetDay: 1,
    costAmount: 45,
    costCurrency: 'USD',
    costPeriod: 'monthly',
    expiresAt: '2026-12-15',
    autoRenew: true,
    tags: ['原生IP', '流媒体解锁', 'Shadowsocks 2022', '双栈'],
    shadowsocks: generateShadowsocksCredentials(),
    lastSeen: futureSeen,
    createdAt: now - 200 * DAY,
    os: 'Debian 11 (bullseye)',
    arch: 'x86_64',
    uptime: '320天 9小时',
    loadAvg: [0.18, 0.22, 0.20],
    memTotalBytes: 2 * 1024 * GB,
    memUsedBytes: Math.floor(0.48 * 1024 * GB),
    diskTotalBytes: 40 * GB,
    diskUsedBytes: Math.floor(7.2 * GB),
    tcpCount: 85,
    udpCount: 18,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 1,
    appliedConfigVersion: 1,
  },
  {
    id: 'node-us-unlock',
    name: '🇺🇸 硅谷原生 · OpenAI / Claude AI 住宅专递',
    ip: '142.250.72.68',
    port: 8388,
    type: 'unlock',
    protocol: 'shadowsocks',
    status: 'online',
    country: 'US',
    countryName: '美国原生住宅',
    token: 'tok_us_un_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(1.15 * 1024 * GB),
    trafficLimitBytes: 4 * 1024 * GB,
    uplinkSpeedBytes: 1.1 * 1024 * 1024,
    downlinkSpeedBytes: 4.8 * 1024 * 1024,
    cpuUsage: 14.8,
    memUsage: 22.0,
    diskUsage: 15.6,
    latencyMs: 142,
    bandwidthMbps: 500,
    trafficResetDay: 1,
    costAmount: 60,
    costCurrency: 'USD',
    costPeriod: 'monthly',
    expiresAt: '2027-02-01',
    autoRenew: true,
    tags: ['住宅IP', 'OpenAI解锁', 'Claude解锁', '干净风控分'],
    shadowsocks: generateShadowsocksCredentials(),
    lastSeen: futureSeen,
    createdAt: now - 112 * DAY,
    os: 'Ubuntu 24.04 LTS',
    arch: 'arm64',
    uptime: '112天 14小时',
    loadAvg: [0.14, 0.16, 0.15],
    memTotalBytes: 4 * 1024 * GB,
    memUsedBytes: Math.floor(0.88 * 1024 * GB),
    diskTotalBytes: 50 * GB,
    diskUsedBytes: Math.floor(7.8 * GB),
    tcpCount: 96,
    udpCount: 24,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 1,
    appliedConfigVersion: 1,
  },
  {
    id: 'node-kr-01',
    name: '🇰🇷 首尔 · 低延迟游戏专线 [已熔断保护]',
    ip: '211.234.118.50',
    port: 443,
    type: 'direct',
    protocol: 'vless-reality',
    status: 'circuit_broken',
    country: 'KR',
    countryName: '韩国首尔',
    token: 'tok_kr_01_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(1.97 * 1024 * GB), // 98.5%
    trafficLimitBytes: 2 * 1024 * GB,
    uplinkSpeedBytes: 0,
    downlinkSpeedBytes: 0,
    cpuUsage: 4.2,
    memUsage: 19.8,
    diskUsage: 22.4,
    latencyMs: 42,
    bandwidthMbps: 500,
    trafficResetDay: 1,
    costAmount: 85,
    costCurrency: 'CNY',
    costPeriod: 'monthly',
    expiresAt: '2026-11-10',
    autoRenew: false,
    tags: ['韩服电竞', '超额保护', '自动熔断', 'SK专线'],
    reality: generateRealityCredentials('www.samsung.com'),
    lastSeen: futureSeen,
    createdAt: now - 54 * DAY,
    os: 'Debian 12 (bookworm)',
    arch: 'x86_64',
    uptime: '54天 2小时',
    loadAvg: [0.05, 0.08, 0.06],
    memTotalBytes: 2 * 1024 * GB,
    memUsedBytes: Math.floor(0.40 * 1024 * GB),
    diskTotalBytes: 40 * GB,
    diskUsedBytes: Math.floor(8.9 * GB),
    tcpCount: 12,
    udpCount: 4,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 2,
    appliedConfigVersion: 2,
  },
  {
    id: 'node-probe-bj',
    name: '🇨🇳 北京 BGP · 核心遥测探针站',
    ip: '123.125.114.33',
    port: 0,
    type: 'probe',
    protocol: 'probe',
    status: 'online',
    country: 'CN',
    countryName: '中国北京',
    token: 'tok_probe_bj_' + crypto.randomBytes(8).toString('hex'),
    trafficUsedBytes: Math.floor(14.8 * GB),
    trafficLimitBytes: 1000 * GB,
    uplinkSpeedBytes: 120 * 1024,
    downlinkSpeedBytes: 450 * 1024,
    cpuUsage: 8.5,
    memUsage: 18.2,
    diskUsage: 14.0,
    latencyMs: 8,
    bandwidthMbps: 200,
    trafficResetDay: 1,
    costAmount: 39,
    costCurrency: 'CNY',
    costPeriod: 'monthly',
    expiresAt: '2027-08-01',
    autoRenew: true,
    tags: ['独立探针', '国内监控站', '全网时序分析'],
    lastSeen: futureSeen,
    createdAt: now - 365 * DAY,
    os: 'Debian 12 (bookworm)',
    arch: 'x86_64',
    uptime: '365天 0小时',
    loadAvg: [0.10, 0.12, 0.11],
    memTotalBytes: 2 * 1024 * GB,
    memUsedBytes: Math.floor(0.36 * 1024 * GB),
    diskTotalBytes: 30 * GB,
    diskUsedBytes: Math.floor(4.2 * GB),
    tcpCount: 28,
    udpCount: 8,
    xrayVersion: 'v1.8.24',
    tcpCongestion: 'bbr',
    configVersion: 1,
    appliedConfigVersion: 1,
  },
];

// Attach required schema and billing fields to all nodes
for (const node of nodes) {
  node.agentSchemaVersion = 2;
  node.trafficPeriodStart = billingPeriod(now, node.trafficResetDay || 1);
  node.configSyncStatus = 'synced';
  node.configSyncedAt = now - 3600 * 1000;
}

const relays = [
  {
    id: 'relay-hk-sg',
    name: '🇭🇰 香港入口 ➔ 🇸🇬 新加坡流媒体解锁',
    mainNodeId: 'node-hk-01',
    unlockNodeId: 'node-sg-unlock',
    mode: 'ai_media',
    customServices: ['OpenAI', 'Anthropic', 'Netflix', 'Disney+'],
    chainUuid: crypto.randomUUID(),
    status: 'active',
    createdAt: now - 30 * DAY,
  },
  {
    id: 'relay-us-ai',
    name: '🇺🇸 洛杉矶 9929 ➔ 🇺🇸 硅谷原生 AI 专用链路',
    mainNodeId: 'node-us-01',
    unlockNodeId: 'node-us-unlock',
    mode: 'all',
    chainUuid: crypto.randomUUID(),
    status: 'active',
    createdAt: now - 45 * DAY,
  },
  {
    id: 'relay-jp-sg',
    name: '🇯🇵 东京软银 ➔ 🇸🇬 狮城流媒体备选中转',
    mainNodeId: 'node-jp-01',
    unlockNodeId: 'node-sg-unlock',
    mode: 'custom',
    customDomains: ['*.openai.com', '*.netflix.com', '*.disneyplus.com'],
    chainUuid: crypto.randomUUID(),
    status: 'active',
    createdAt: now - 20 * DAY,
  },
];

const subscriptions = [
  {
    id: 'sub-global-vip',
    name: '🚀 全球 VIP 全协议自适应专线',
    token: 'sub_99a8b7c6d5e4f3a2b1029384',
    nodeIds: ['node-hk-01', 'node-jp-01', 'node-sg-01', 'node-us-01', 'node-de-01', 'node-sg-unlock', 'node-us-unlock'],
    expireAt: 1893456000, // 2030-01-01
    createdAt: now - 60 * DAY,
    customHost: 'sub.nodemaster.io',
  },
  {
    id: 'sub-ai-media',
    name: '🤖 AI 大模型 & 流媒体智能链式订阅',
    token: 'sub_77c8d9e0f1a2b3c4d5e6f7a8',
    nodeIds: ['node-hk-01', 'node-jp-01', 'node-us-01', 'node-sg-unlock', 'node-us-unlock'],
    expireAt: 1861920000, // 2029-01-01
    createdAt: now - 40 * DAY,
  },
  {
    id: 'sub-asia-fast',
    name: '⚡ 亚太极速低延迟专线 (港/日/新/韩)',
    token: 'sub_55e6f7a8b9c0d1e2f3a4b5c6',
    nodeIds: ['node-hk-01', 'node-jp-01', 'node-sg-01', 'node-kr-01'],
    expireAt: 1830384000, // 2028-01-01
    createdAt: now - 25 * DAY,
  },
];

const telegramConfig = {
  enabled: true,
  botToken: '6899823412:AAH9f23kL09mNmPqRsTuVwXyZ1234567890',
  chatId: '-1001982736450',
  apiEndpoint: 'https://api.telegram.org',
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

const telegramLogs = [
  {
    id: 'log-01',
    type: 'offline',
    nodeId: 'node-kr-01',
    nodeName: '🇰🇷 首尔 · 低延迟游戏专线',
    title: '🛑 流量超额自动熔断保护触发',
    message: '该节点当月累计使用量已达 1.97TB (占比 98.5% 已超 98% 熔断阈值)。系统已切断入站代理连接，保护落地机器免遭高额超量账单扣费。将于下月 1 日零点自动恢复。',
    timestamp: now - 25 * 60 * 1000,
    success: true,
  },
  {
    id: 'log-02',
    type: 'recovery',
    nodeId: 'node-hk-01',
    nodeName: '🇭🇰 香港 CN2 GIA · 极速专线',
    title: '🟢 节点探针遥测与网络恢复在线',
    message: '硬件探针遥测已恢复，WebSocket 双向遥测通道正常握手，当前 TCP 综合物理延迟 18ms，网卡丢包率 0.00%。',
    timestamp: now - 3 * HOUR,
    success: true,
  },
  {
    id: 'log-03',
    type: 'traffic',
    nodeId: 'node-us-01',
    nodeName: '🇺🇸 洛杉矶 AS9929 · 美西优化',
    title: '⚠️ 月度流量阈值预警 (80%)',
    message: '本月月度配额 15TB，当前用量已达 8.42TB (占比 56.1%)，下行峰值带宽达 15.6MB/s，用量稳步上升。',
    timestamp: now - 8 * HOUR,
    success: true,
  },
  {
    id: 'log-04',
    type: 'cpu',
    nodeId: 'node-sg-01',
    nodeName: '🇸🇬 新加坡 · 亚太骨干枢纽',
    title: '⚡ VPS 瞬时高负载预警 (LoadAvg 0.65)',
    message: '多路 4K 媒体数据流并发接入，CPU 核心占用率达 31.2%，内存使用率 53.4%，系统资源在健康波动区间。',
    timestamp: now - 14 * HOUR,
    success: true,
  },
  {
    id: 'log-05',
    type: 'renewal',
    nodeId: 'node-jp-01',
    nodeName: '🇯🇵 东京 BGP · 软银金融专线',
    title: '⏰ 云服务器即将到期提醒',
    message: '实例到期日为 2026-11-20，剩余 24 天，请关注云服务商账户余额并确保自动续费机制生效。',
    timestamp: now - 22 * HOUR,
    success: true,
  },
  {
    id: 'log-06',
    type: 'test',
    title: '🤖 Telegram 机器人通信链路自检成功',
    message: 'NodeMaster 告警机器人 API 端点握手正常，响应延迟 210ms，具备双向 MarkdownV2 模板消息推送能力。',
    timestamp: now - 36 * HOUR,
    success: true,
  },
];

const latencyTasks = existingDb.latencyTasks || [
  { id: 'task-gd-cm', name: '广东移动', target: 'gd-cm-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 1 },
  { id: 'task-gd-cu', name: '广东联通', target: 'gd-cu-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 2 },
  { id: 'task-gd-ct', name: '广东电信', target: 'gd-ct-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 3 },
  { id: 'task-hb-cm', name: '湖北移动', target: 'hb-cm-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 4 },
  { id: 'task-hb-cu', name: '湖北联通', target: 'hb-cu-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 5 },
  { id: 'task-hb-ct', name: '湖北电信', target: 'hb-ct-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 6 },
  { id: 'task-sc-cm', name: '四川移动', target: 'sc-cm-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 7 },
  { id: 'task-sc-cu', name: '四川联通', target: 'sc-cu-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 8 },
  { id: 'task-sc-ct', name: '四川电信', target: 'sc-ct-v4.ip.zstaticcdn.com:80', type: 'tcp', intervalSec: 60, nodeIds: [], enabled: true, order: 9 },
];

const database = {
  nodes,
  relays,
  subscriptions,
  config: {
    autoCircuitBreaker: true,
    circuitBreakerThresholdPct: 98,
    trafficResetDay: 1,
    jwtSecret,
  },
  latencyTasks,
  telegramConfig,
  telegramLogs,
  admin,
  configSchemaVersion: 3,
};

fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf-8');
console.log(`✓ Seeded ${nodes.length} nodes, ${relays.length} relays, ${subscriptions.length} subscriptions to ${DB_FILE}`);

// Now generate realistic telemetry samples and latency samples for historyStore
const samples = [];
const latencySamples = [];

// Base latencies for each node to Chinese regions (Telecom, Unicom, Mobile)
const nodeBaseLatency = {
  'node-hk-01': 18,
  'node-jp-01': 36,
  'node-sg-01': 52,
  'node-us-01': 132,
  'node-de-01': 168,
  'node-sg-unlock': 58,
  'node-us-unlock': 142,
  'node-kr-01': 42,
  'node-probe-bj': 8,
};

// Generate 48 hourly points (past 2 days)
const totalSteps = 48;
for (let step = 0; step < totalSteps; step++) {
  const ts = now - (totalSteps - 1 - step) * HOUR;

  for (const node of nodes) {
    const isCircuitBroken = node.status === 'circuit_broken';
    const variance = Math.sin(step / 3) * 0.2 + (Math.random() - 0.5) * 0.1;
    const cpu = isCircuitBroken ? 3.5 : Math.max(5, Math.min(80, node.cpuUsage * (1 + variance)));
    const mem = Math.max(10, Math.min(90, node.memUsage * (1 + variance * 0.3)));
    const disk = node.diskUsage;
    const up = isCircuitBroken ? 0 : Math.max(0, Math.floor(node.uplinkSpeedBytes * (1 + variance)));
    const down = isCircuitBroken ? 0 : Math.max(0, Math.floor(node.downlinkSpeedBytes * (1 + variance)));
    const tx = Math.floor(up * 3600);
    const rx = Math.floor(down * 3600);

    samples.push({
      nodeId: node.id,
      timestamp: ts,
      cpu: Math.round(cpu * 10) / 10,
      mem: Math.round(mem * 10) / 10,
      disk: Math.round(disk * 10) / 10,
      up,
      down,
      tx,
      rx,
      n: 6, // represents consolidated 5-minute samples
    });

    // Latency points for this step
    const base = nodeBaseLatency[node.id] || 50;
    for (const task of latencyTasks) {
      // slight operator difference: telecom +0, unicom +3, mobile +8
      const opDelta = task.id.endsWith('ct') ? 0 : task.id.endsWith('cu') ? 3 : 8;
      const jitterVal = Math.round((Math.random() * 2.5 + 0.5) * 10) / 10;
      const latVal = Math.round((base + opDelta + (Math.random() - 0.5) * 4) * 10) / 10;
      const lossVal = isCircuitBroken ? 0 : Math.random() < 0.05 ? 0.01 : 0;

      latencySamples.push({
        nodeId: node.id,
        taskId: task.id,
        timestamp: ts,
        latencyMs: latVal,
        lossRate: lossVal,
        jitter: jitterVal,
        n: 6,
      });
    }
  }
}

const historyData = {
  samples,
  latency: latencySamples,
};

fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData), 'utf-8');
console.log(`✓ Seeded ${samples.length} telemetry samples and ${latencySamples.length} latency history records to ${HISTORY_FILE}`);
