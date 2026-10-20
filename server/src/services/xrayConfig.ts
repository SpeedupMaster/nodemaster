import crypto from "crypto";
import { InputError } from "./validation.js";
import { newRealityKeyPair } from "./security.js";
import { ROUTING_RULES, xrayConditions } from "./routingRules.js";
import { DEFAULT_SNI, DEFAULT_SS_CIPHER, REALITY_FINGERPRINT, REALITY_FLOW, SS_CIPHERS, ssKeyLength } from "../constants.js";
import type { NodeItem, XrayRealityConfig, ShadowsocksConfig, RelayLink } from "../types/index.js";
import { db } from "../db/index.js";

// Email tags identify VLESS clients in routing rules ("user" field)
export const DIRECT_CLIENT_EMAIL = "nodemaster_client@local";
export const CHAIN_CLIENT_EMAIL = "nodemaster_chain@local";

export interface ServiceDefinition {
  id: string;
  name: string;
  category: "ai" | "streaming" | "social" | "gaming" | "finance" | "other";
  categoryName: string;
  geosite: string[];
  domains: string[];
  geoip?: string[];
  ips?: string[];
  description: string;
}

export const UNLOCK_SERVICES: ServiceDefinition[] = [
  // --- AI 智能模型 ---
  {
    id: "openai",
    name: "OpenAI / ChatGPT",
    category: "ai",
    categoryName: "AI 智能模型",
    geosite: ["openai", "category-ai-chat-!cn"],
    domains: ["openai.com", "chatgpt.com", "oaistatic.com", "oaiusercontent.com", "sora.com"],
    description: "ChatGPT, GPT-4o, Sora 视频与官方 API",
  },
  {
    id: "anthropic",
    name: "Claude / Anthropic",
    category: "ai",
    categoryName: "AI 智能模型",
    geosite: ["anthropic"],
    domains: ["claude.ai", "anthropic.com"],
    description: "Claude 3.5 Sonnet / Opus 网页端与 API",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "ai",
    categoryName: "AI 智能模型",
    geosite: ["google"],
    domains: ["gemini.google.com", "generativelanguage.googleapis.com", "ai.google.dev", "aistudio.google.com"],
    description: "Gemini 1.5 Pro, AI Studio 与 Google AI",
  },
  {
    id: "copilot",
    name: "Microsoft Copilot",
    category: "ai",
    categoryName: "AI 智能模型",
    geosite: ["microsoft"],
    domains: ["copilot.microsoft.com", "edgeservices.bing.com", "sydnet.bing.com"],
    description: "Windows / Edge Copilot 智能助手",
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    category: "ai",
    categoryName: "AI 智能模型",
    geosite: ["perplexity"],
    domains: ["perplexity.ai"],
    description: "Perplexity 智能搜索与 AI 问答平台",
  },
  {
    id: "midjourney",
    name: "Midjourney",
    category: "ai",
    categoryName: "AI 智能模型",
    geosite: ["midjourney"],
    domains: ["midjourney.com"],
    description: "Midjourney 图像生成平台与网页端",
  },

  // --- 全球主流流媒体 ---
  {
    id: "netflix",
    name: "Netflix",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["netflix"],
    domains: ["netflix.com", "netflix.net", "nflximg.net", "nflxvideo.net", "nflxext.com"],
    description: "网飞原生剧集与 4K 非自制版权影片解锁",
  },
  {
    id: "disney",
    name: "Disney+",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["disney"],
    domains: ["disneyplus.com", "disneystreaming.com", "disney-portal.my.onetrust.com", "dssott.com"],
    description: "迪士尼+、皮克斯、漫威、星球大战与国家地理",
  },
  {
    id: "youtube",
    name: "YouTube / YouTube Music",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["youtube"],
    domains: ["youtube.com", "googlevideo.com", "ytimg.com", "youtu.be", "youtubekids.com"],
    description: "YouTube Premium 会员与免广告原生出口",
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["tiktok"],
    domains: ["tiktok.com", "tiktokv.com", "tiktokcdn.com", "byteoversea.com", "ibytedtos.com"],
    description: "国际版抖音短视频与直播原生住宅出口",
  },
  {
    id: "spotify",
    name: "Spotify",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["spotify"],
    domains: ["spotify.com", "scdn.co", "spoti.fi"],
    description: "Spotify 全球音乐流媒体曲库与区域版权",
  },
  {
    id: "hbo",
    name: "Max / HBO Max",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["max"],
    domains: ["max.com", "hbo.com", "hbomax.com", "hbonow.com"],
    description: "华纳兄弟 Discovery 与 HBO 顶级剧集",
  },
  {
    id: "primevideo",
    name: "Amazon Prime Video",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["primevideo"],
    domains: ["primevideo.com", "amazonvideo.com", "aiv-cdn.net"],
    description: "亚马逊 Prime Video 影视解锁",
  },
  {
    id: "hulu",
    name: "Hulu",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["hulu"],
    domains: ["hulu.com", "hulustream.com"],
    description: "美国主流流媒体 Hulu 视频与美剧",
  },
  {
    id: "appletv",
    name: "Apple TV+ / Apple Music",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["apple"],
    domains: ["tv.apple.com", "music.apple.com", "hls.itunes.apple.com"],
    description: "苹果自制剧集 Apple TV+ 与高解析无损音乐",
  },
  {
    id: "bilibili_overseas",
    name: "哔哩哔哩 (港澳台/东南亚)",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["bilibili"],
    domains: ["bilibili.com", "bilibili.tv"],
    description: "解除 B 站番剧仅限港澳台或东南亚播放限制",
  },
  {
    id: "bahamut",
    name: "巴哈姆特动画疯",
    category: "streaming",
    categoryName: "全球流媒体",
    geosite: ["bahamut"],
    domains: ["gamer.com.tw"],
    description: "台湾正版二次元动画新番同步流媒体",
  },

  // --- 社交与即时通讯 ---
  {
    id: "telegram",
    name: "Telegram",
    category: "social",
    categoryName: "海外社交",
    geosite: ["telegram"],
    geoip: ["telegram"],
    domains: ["t.me", "telegram.org", "telegra.ph", "cdn-telegram.org"],
    description: "Telegram 极速代理与媒体文件下载",
  },
  {
    id: "twitter",
    name: "Twitter / X",
    category: "social",
    categoryName: "海外社交",
    geosite: ["twitter"],
    domains: ["x.com", "twitter.com", "twimg.com", "t.co"],
    description: "推特/X 动态浏览与多媒体上传下载",
  },
  {
    id: "discord",
    name: "Discord",
    category: "social",
    categoryName: "海外社交",
    geosite: ["discord"],
    domains: ["discord.com", "discord.gg", "discordapp.com", "discordapp.net"],
    description: "Discord 社区语音通话与频道聊天",
  },
  {
    id: "reddit",
    name: "Reddit",
    category: "social",
    categoryName: "海外社交",
    geosite: ["reddit"],
    domains: ["reddit.com", "redd.it", "redditmedia.com"],
    description: "全球最大论坛 Reddit 社区与高清多媒体",
  },
  {
    id: "instagram",
    name: "Instagram / Threads",
    category: "social",
    categoryName: "海外社交",
    geosite: ["instagram"],
    domains: ["instagram.com", "threads.net", "cdninstagram.com"],
    description: "Instagram 照片墙与 Meta Threads 社区",
  },

  // --- 跨境支付与金融 ---
  {
    id: "paypal",
    name: "PayPal",
    category: "finance",
    categoryName: "跨境支付与金融",
    geosite: ["paypal"],
    domains: ["paypal.com", "paypalobjects.com"],
    description: "PayPal 国际版风控防封号住宅 IP 伪装出口",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "finance",
    categoryName: "跨境支付与金融",
    geosite: [],
    domains: ["stripe.com", "stripe.network"],
    description: "全球在线支付结算与商家后台防风控",
  },

  // --- 游戏平台 ---
  {
    id: "steam",
    name: "Steam 社区与商店",
    category: "gaming",
    categoryName: "游戏平台",
    geosite: ["steam"],
    domains: ["steampowered.com", "steamcommunity.com", "steamgames.com"],
    description: "Steam 外服商店锁区购买与社区讨论区访问",
  },
  {
    id: "epic",
    name: "Epic Games",
    category: "gaming",
    categoryName: "游戏平台",
    geosite: ["epicgames"],
    domains: ["epicgames.com"],
    description: "Epic 商城外服领游戏与账号验证",
  },
];

export function generateRealityCredentials(serverName = DEFAULT_SNI): XrayRealityConfig {
  const { privateKey, publicKey } = newRealityKeyPair();
  return {
    uuid: crypto.randomUUID(),
    flow: REALITY_FLOW,
    serverName,
    publicKey,
    privateKey,
    shortId: crypto.randomBytes(8).toString("hex"),
    fingerprint: REALITY_FINGERPRINT,
    dest: `${serverName}:443`,
  };
}

export function generateShadowsocksCredentials(method: string = DEFAULT_SS_CIPHER, password?: string): ShadowsocksConfig {
  if (!(SS_CIPHERS as readonly string[]).includes(method)) throw new InputError("不支持的 Shadowsocks 加密方式");
  const length = ssKeyLength(method);
  if (password && method.startsWith("2022-") && Buffer.from(password, "base64").length !== length) {
    throw new InputError(`Shadowsocks 2022 密码须为 ${length} 字节的 Base64 编码`);
  }
  return { method, password: password || crypto.randomBytes(length).toString("base64") };
}

const SNIFFING = { enabled: true, destOverride: ["http", "tls", "quic"], routeOnly: true };

/**
 * Generating fresh keys here would hand the node a config that matches neither its previous one nor
 * the subscriptions, so missing credentials are an error the agent reports back as a failed sync.
 */
function requireCredentials<K extends "reality" | "shadowsocks">(node: NodeItem, kind: K): NonNullable<NodeItem[K]> {
  const value = node[kind];
  if (!value) throw new Error(`Node ${node.id} has no ${kind} credentials`);
  return value as NonNullable<NodeItem[K]>;
}

function unlockOutbound(unlock: NodeItem) {
  if (unlock.protocol === "shadowsocks") {
    const ss = requireCredentials(unlock, "shadowsocks");
    return {
      tag: "UNLOCK_OUT",
      protocol: "shadowsocks",
      settings: {
        servers: [{
          address: unlock.ip,
          port: unlock.port,
          method: ss.method,
          password: ss.password,
          // UDP-over-TCP is only implemented for the 2022 ciphers on the Xray server side
          ...(ss.method.startsWith("2022-") ? { uot: true } : {}),
        }],
      },
    };
  }
  const r = requireCredentials(unlock, "reality");
  return {
    tag: "UNLOCK_OUT",
    protocol: "vless",
    settings: { vnext: [{ address: unlock.ip, port: unlock.port, users: [{ id: r.uuid, flow: r.flow, encryption: "none" }] }] },
    streamSettings: {
      network: "raw",
      security: "reality",
      realitySettings: { show: false, serverName: r.serverName, publicKey: r.publicKey, shortId: r.shortId, fingerprint: r.fingerprint },
    },
  };
}

/** Domain / IP matchers for a relay in "custom" mode (or with explicitly selected services). */
function customUnlockMatchers(relay: RelayLink) {
  const domains: string[] = [];
  const ips: string[] = [];
  for (const svc of UNLOCK_SERVICES.filter((s) => relay.customServices?.includes(s.id))) {
    domains.push(...svc.geosite.map((g) => `geosite:${g}`), ...svc.domains.map((d) => `domain:${d}`));
    ips.push(...(svc.geoip || []).map((g) => `geoip:${g}`), ...(svc.ips || []));
  }
  for (const entry of relay.customDomains || []) {
    const value = entry.trim();
    if (!value) continue;
    const isIp = value.startsWith("geoip:") || value.includes("/") || /^\d+\.\d+\.\d+\.\d+$/.test(value) || /^[0-9a-f]*:[0-9a-f:]+$/i.test(value);
    if (isIp) ips.push(value);
    else domains.push(value.includes(":") ? value : `domain:${value}`);
  }
  return { domains: [...new Set(domains)], ips: [...new Set(ips)] };
}

/** Generates the Xray server config.json for a node, including the chained unlock egress if any. */
export function generateXrayServerConfig(node: NodeItem, unlock?: NodeItem, relay?: RelayLink) {
  const outbounds: object[] = [{ tag: "DIRECT", protocol: "freedom" }, { tag: "BLOCK", protocol: "blackhole" }];
  if (unlock) outbounds.push(unlockOutbound(unlock));

  // The main node exposes two VLESS clients: the plain direct entry and, when a relay is active, a
  // dedicated chain client used by the 🔗 subscription entry. Only the chain client is ever routed to
  // UNLOCK_OUT, so the two entries behave differently. Shadowsocks inbounds cannot tell users apart,
  // so for them the relay applies to every connection (legacy behaviour).
  const inboundTag = node.protocol === "shadowsocks" ? `SS_${node.id}` : `VLESS_REALITY_${node.id}`;
  const chainUuid = unlock && node.protocol !== "shadowsocks" ? relay?.chainUuid : undefined;
  const chainScope = chainUuid ? { user: [CHAIN_CLIENT_EMAIL] } : {};

  // Server side, "private" means the VPS's own loopback/LAN/cloud metadata: never reachable through
  // the proxy, whatever the rules say (a client-side "LAN direct" rule must not become an SSRF).
  const rules: object[] = [
    { type: "field", ip: ["geoip:private"], outboundTag: "BLOCK" },
    { type: "field", domain: ["geosite:private"], outboundTag: "BLOCK" },
    { type: "field", protocol: ["bittorrent"], outboundTag: "BLOCK" },
  ];

  const mode = relay?.mode || "ai_media";
  if (unlock && mode === "all") {
    rules.push({ type: "field", inboundTag: [inboundTag], ...chainScope, outboundTag: "UNLOCK_OUT" });
  } else if (unlock && relay && (mode === "custom" || (relay.customServices?.length ?? 0) > 0)) {
    // Xray ORs values only within one field, so domains and IPs need separate rules.
    const { domains, ips } = customUnlockMatchers(relay);
    if (domains.length) rules.push({ type: "field", ...chainScope, domain: domains, outboundTag: "UNLOCK_OUT" });
    if (ips.length) rules.push({ type: "field", ...chainScope, ip: ips, outboundTag: "UNLOCK_OUT" });
  } else {
    // Built-in rules. On the server only BLOCK and UNLOCK_OUT matter: everything else (DIRECT, and
    // PROXY, which on a client means "use the proxy" — the server IS the proxy) leaves through the
    // default DIRECT outbound.
    for (const rule of ROUTING_RULES) {
      const outboundTag = rule.targetOutbound === "BLOCK" ? "BLOCK" : rule.targetOutbound === "UNLOCK_OUT" && unlock ? "UNLOCK_OUT" : "DIRECT";
      const { domain, ip } = xrayConditions(rule);
      const protocol = rule.protocol?.length ? { protocol: rule.protocol } : {};
      const scope = outboundTag === "UNLOCK_OUT" ? chainScope : {};
      // A rule without any condition is a catch-all (the fallback rule); on the server that is simply
      // the default outbound, and emitting it would shadow every rule after it.
      if (domain.length) rules.push({ type: "field", ...scope, ...protocol, domain, outboundTag });
      if (ip.length) rules.push({ type: "field", ...scope, ...protocol, ip, outboundTag });
      if (!domain.length && !ip.length && rule.protocol?.length) rules.push({ type: "field", ...scope, ...protocol, outboundTag });
    }
  }

  return {
    log: { loglevel: "warning" },
    dns: { servers: ["1.1.1.1", "8.8.8.8"] },
    inbounds: node.status === "circuit_broken" ? [] : [serverInbound(node, inboundTag, chainUuid)],
    outbounds,
    routing: {
      // Resolve a domain only when no domain rule matched, so geoip rules (unlock IP ranges, and the
      // private-range block above, e.g. against DNS-rebinding names pointing at 127.0.0.1) also apply
      // to connections addressed by domain.
      domainStrategy: "IPIfNonMatch",
      rules,
    },
  };
}

function serverInbound(node: NodeItem, tag: string, chainUuid?: string) {
  if (node.protocol === "shadowsocks") {
    const ss = requireCredentials(node, "shadowsocks");
    return {
      tag,
      listen: "0.0.0.0",
      port: node.port,
      protocol: "shadowsocks",
      settings: { method: ss.method, password: ss.password, network: "tcp,udp" },
      sniffing: SNIFFING,
    };
  }
  const reality = requireCredentials(node, "reality");
  return {
    tag,
    listen: "0.0.0.0",
    port: node.port,
    protocol: "vless",
    settings: {
      clients: [
        { id: reality.uuid, flow: reality.flow, email: DIRECT_CLIENT_EMAIL },
        ...(chainUuid ? [{ id: chainUuid, flow: reality.flow, email: CHAIN_CLIENT_EMAIL }] : []),
      ],
      decryption: "none",
    },
    sniffing: SNIFFING,
    streamSettings: {
      network: "raw",
      security: "reality",
      realitySettings: {
        show: false,
        target: reality.dest,
        xver: 0,
        serverNames: [reality.serverName],
        privateKey: reality.privateKey,
        shortIds: [reality.shortId],
        maxTimeDiff: 0,
      },
    },
  };
}

/** Config for a node as currently stored, resolving its active relay and unlock node. */
export function getNodeXrayConfig(node: NodeItem) {
  const relay = db.getActiveRelayFor(node.id);
  const unlock = relay ? db.getNodeById(relay.unlockNodeId) : undefined;
  return generateXrayServerConfig(node, unlock, unlock ? relay : undefined);
}

