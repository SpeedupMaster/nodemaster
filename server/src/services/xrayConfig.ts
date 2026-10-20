import crypto from "crypto";
import { newRealityKeyPair } from "./security.js";
import { NodeItem, XrayRealityConfig, ShadowsocksConfig, RoutingRule, RelayLink } from "../types/index.js";
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

// Helper to generate reality credentials
export function generateRealityCredentials(serverName = "www.microsoft.com"): XrayRealityConfig {
  const uuid = crypto.randomUUID();
  const { privateKey, publicKey } = newRealityKeyPair();
  const shortId = crypto.randomBytes(8).toString("hex");

  return {
    uuid,
    flow: "xtls-rprx-vision",
    serverName,
    publicKey,
    privateKey,
    shortId,
    fingerprint: "chrome",
    dest: `${serverName}:443`,
  };
}

// Helper to generate shadowsocks credentials for unlock nodes
export function generateShadowsocksCredentials(
  method = "2022-blake3-aes-128-gcm",
  password?: string
): ShadowsocksConfig {
  const methods = ["2022-blake3-aes-128-gcm", "2022-blake3-aes-256-gcm", "2022-blake3-chacha20-poly1305", "aes-128-gcm", "aes-256-gcm", "chacha20-ietf-poly1305"];
  if (!methods.includes(method)) throw new Error("Unsupported Shadowsocks cipher");
  const length = method === "2022-blake3-aes-128-gcm" ? 16 : 32;
  if (password && method.startsWith("2022-") && Buffer.from(password, "base64").length !== length) throw new Error(`Shadowsocks password must encode ${length} bytes`);
  return {
    method,
    // 16-byte base64 password is valid for 2022-blake3-aes-128-gcm and standard AEAD
    password: password || crypto.randomBytes(length).toString("base64"),
  };
}

// Generate the Xray server-side config.json for a node (including chained unlock proxy)
export function generateXrayServerConfig(
  node: NodeItem,
  targetUnlockNode?: NodeItem,
  unlockMode: "ai_media" | "all" | "custom" = "ai_media",
  relay?: RelayLink
) {
  // Outbounds definition
  const outbounds: any[] = [
    {
      tag: "DIRECT",
      protocol: "freedom",
    },
    {
      tag: "BLOCK",
      protocol: "blackhole",
    },
  ];

  // If paired with an Unlock Node, append UNLOCK_OUT outbound
  if (targetUnlockNode) {
    if (targetUnlockNode.protocol === "shadowsocks" || targetUnlockNode.shadowsocks) {
      // Unlock node uses lightweight Shadowsocks (SS 2022 / AEAD)
      const ss = targetUnlockNode.shadowsocks || generateShadowsocksCredentials();
      outbounds.push({
        tag: "UNLOCK_OUT",
        protocol: "shadowsocks",
        settings: {
          servers: [
            {
              address: targetUnlockNode.ip,
              port: targetUnlockNode.port || 8388,
              method: ss.method || "2022-blake3-aes-128-gcm",
              password: ss.password,
              // UDP-over-TCP is only implemented for the 2022 ciphers on the Xray server side
              ...(String(ss.method || "2022-blake3-aes-128-gcm").startsWith("2022-") ? { uot: true } : {}),
            },
          ],
        },
      });
    } else if (targetUnlockNode.reality) {
      // Fallback: VLESS-Reality egress chain
      const ur = targetUnlockNode.reality;
      outbounds.push({
        tag: "UNLOCK_OUT",
        protocol: "vless",
        settings: {
          vnext: [
            {
              address: targetUnlockNode.ip,
              port: targetUnlockNode.port || 443,
              users: [
                {
                  id: ur.uuid,
                  flow: ur.flow || "xtls-rprx-vision",
                  encryption: "none",
                },
              ],
            },
          ],
        },
        streamSettings: {
          network: "raw",
          security: "reality",
          realitySettings: {
            show: false,
            serverName: ur.serverName,
            publicKey: ur.publicKey,
            shortId: ur.shortId,
            fingerprint: ur.fingerprint || "chrome",
          },
        },
      });
    }
  }

  // Routing.
  // The main node exposes two VLESS clients: the plain direct entry and, when a relay is active, a
  // dedicated chain client used by the 🔗 subscription entry. Only the chain client is ever routed to
  // UNLOCK_OUT, so the two entries behave differently. Shadowsocks inbounds cannot tell users apart,
  // so for them the relay applies to every connection (legacy behaviour).
  const vlessTag = `VLESS_REALITY_${node.id}`;
  const ssTag = `SS_${node.id}`;
  const chainUuid = targetUnlockNode && node.protocol !== "shadowsocks" ? relay?.chainUuid : undefined;
  const chainScope: Record<string, unknown> = chainUuid ? { user: [CHAIN_CLIENT_EMAIL] } : {};

  // Server side, "private" means the VPS's own loopback/LAN/cloud metadata: never reachable through
  // the proxy, whatever the panel rules say (a client-side "LAN direct" rule must not become an SSRF).
  const routingRules: any[] = [
    { type: "field", ip: ["geoip:private"], outboundTag: "BLOCK" },
    { type: "field", domain: ["geosite:private"], outboundTag: "BLOCK" },
    { type: "field", protocol: ["bittorrent"], outboundTag: "BLOCK" },
  ];

  if (targetUnlockNode && unlockMode === "all") {
    routingRules.push({ type: "field", inboundTag: [vlessTag, ssTag], ...chainScope, outboundTag: "UNLOCK_OUT" });
  } else if (targetUnlockNode && (unlockMode === "custom" || (relay?.customServices?.length ?? 0) > 0)) {
    const matchedDomains: string[] = [];
    const matchedIps: string[] = [];

    for (const sId of relay?.customServices || []) {
      const svc = UNLOCK_SERVICES.find((s) => s.id === sId);
      if (svc) {
        svc.geosite.forEach((g) => matchedDomains.push(g.startsWith("geosite:") ? g : `geosite:${g}`));
        svc.domains.forEach((d) => matchedDomains.push(d.includes(":") ? d : `domain:${d}`));
        if (svc.geoip) svc.geoip.forEach((g) => matchedIps.push(g.startsWith("geoip:") ? g : `geoip:${g}`));
        if (svc.ips) svc.ips.forEach((ip) => matchedIps.push(ip));
      }
    }

    for (const d of relay?.customDomains || []) {
      const trimmed = d.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("geoip:") || /^\d+\.\d+\.\d+\.\d+/.test(trimmed) || trimmed.includes("/")) {
        matchedIps.push(trimmed);
      } else {
        matchedDomains.push(trimmed.includes(":") ? trimmed : `domain:${trimmed}`);
      }
    }

    // Xray ORs the conditions inside one rule only across values of the same field, so domains and
    // IPs need separate rules.
    if (matchedDomains.length > 0) {
      routingRules.push({ type: "field", ...chainScope, domain: Array.from(new Set(matchedDomains)), outboundTag: "UNLOCK_OUT" });
    }
    if (matchedIps.length > 0) {
      routingRules.push({ type: "field", ...chainScope, ip: Array.from(new Set(matchedIps)), outboundTag: "UNLOCK_OUT" });
    }
  } else {
    // Panel routing rules. On the server only BLOCK and UNLOCK_OUT matter: everything else (DIRECT,
    // and PROXY, which on a client means "use the proxy" — the server IS the proxy) leaves through the
    // default DIRECT outbound. Mapping PROXY to UNLOCK_OUT used to send all fallback traffic through
    // the unlock node.
    for (const rule of db.getRoutingRules().filter((r) => r.enabled)) {
      if (rule.inboundNodeIds && rule.inboundNodeIds.length > 0 && !rule.inboundNodeIds.includes(node.id)) continue;

      let outboundTag: string;
      if (rule.targetOutbound === "BLOCK") outboundTag = "BLOCK";
      else if (rule.targetOutbound === "UNLOCK_OUT" && targetUnlockNode) outboundTag = "UNLOCK_OUT";
      else outboundTag = "DIRECT";

      const conditions: Record<string, unknown> = {};
      const domains = [
        ...(rule.geosite || []).map((g) => (g.startsWith("geosite:") ? g : `geosite:${g}`)),
        ...(rule.domains || []).map((d) => (d.includes(":") ? d : `domain:${d}`)),
      ];
      const ips = [...(rule.geoip || []).map((g) => (g.startsWith("geoip:") ? g : `geoip:${g}`)), ...(rule.ips || [])];
      if (rule.protocol && rule.protocol.length > 0) conditions.protocol = rule.protocol;
      if (rule.port && rule.port.trim()) conditions.port = rule.port.trim();
      // A rule without any condition is a catch-all (e.g. the fallback preset); on the server that is
      // simply the default outbound, and emitting it would shadow every rule after it.
      if (domains.length === 0 && ips.length === 0 && Object.keys(conditions).length === 0) continue;

      const scope = outboundTag === "UNLOCK_OUT" ? chainScope : {};
      if (domains.length > 0) routingRules.push({ type: "field", ...scope, ...conditions, domain: domains, outboundTag });
      if (ips.length > 0) routingRules.push({ type: "field", ...scope, ...conditions, ip: ips, outboundTag });
      if (domains.length === 0 && ips.length === 0) routingRules.push({ type: "field", ...scope, ...conditions, outboundTag });
    }
  }

  // Define inbounds based on node protocol
  const inbounds: any[] = [];

  if (node.protocol === "shadowsocks") {
    // Unlock node uses native Shadowsocks inbound
    const ss = node.shadowsocks || generateShadowsocksCredentials();
    inbounds.push({
      tag: `SS_${node.id}`,
      listen: "0.0.0.0",
      port: node.port || 8388,
      protocol: "shadowsocks",
      settings: {
        method: ss.method || "2022-blake3-aes-128-gcm",
        password: ss.password,
        network: "tcp,udp",
      },
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
        routeOnly: true,
      },
    });
  } else {
    // Direct node uses VLESS Reality inbound
    const reality = node.reality || generateRealityCredentials();
    inbounds.push({
      tag: `VLESS_REALITY_${node.id}`,
      listen: "0.0.0.0",
      port: node.port || 443,
      protocol: "vless",
      settings: {
        clients: [
          {
            id: reality.uuid,
            flow: reality.flow || "xtls-rprx-vision",
            email: DIRECT_CLIENT_EMAIL,
          },
          ...(chainUuid
            ? [{ id: chainUuid, flow: reality.flow || "xtls-rprx-vision", email: CHAIN_CLIENT_EMAIL }]
            : []),
        ],
        decryption: "none",
      },
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
        routeOnly: true,
      },
      streamSettings: {
        network: "raw",
        security: "reality",
        realitySettings: {
          show: false,
          target: reality.dest || "www.microsoft.com:443",
          xver: 0,
          serverNames: [reality.serverName || "www.microsoft.com"],
          privateKey: reality.privateKey,
          shortIds: [reality.shortId],
          maxTimeDiff: 0,
        },
      },
    });
  }

  return {
    log: {
      loglevel: "warning",
    },
    dns: {
      servers: ["1.1.1.1", "8.8.8.8"],
    },
    inbounds: node.status === "circuit_broken" ? [] : inbounds,
    outbounds,
    routing: {
      // Resolve a domain only when no domain rule matched, so geoip rules (unlock IP ranges, and the
      // private-range block above, e.g. against DNS-rebinding names pointing at 127.0.0.1) also apply
      // to connections addressed by domain.
      domainStrategy: "IPIfNonMatch",
      rules: routingRules,
    },
  };
}

// Helper to compile a single rule into Xray / Clash / Sing-box syntax for frontend live preview
export function compileRuleForPreview(rule: Partial<RoutingRule>) {
  const target = rule.targetOutbound || "DIRECT";
  const domains = [
    ...(rule.geosite || []).map((g) => (g.startsWith("geosite:") ? g : `geosite:${g}`)),
    ...(rule.domains || []).map((d) => (d.includes(":") ? d : `domain:${d}`)),
  ];
  const ips = [
    ...(rule.geoip || []).map((g) => (g.startsWith("geoip:") ? g : `geoip:${g}`)),
    ...(rule.ips || []),
  ];

  // 1. Xray JSON
  const xrayRule: any = {
    type: "field",
    outboundTag: target,
  };
  if (domains.length > 0) xrayRule.domain = domains;
  if (ips.length > 0) xrayRule.ip = ips;
  if (rule.protocol && rule.protocol.length > 0) xrayRule.protocol = rule.protocol;
  if (rule.port && rule.port.trim()) xrayRule.port = rule.port.trim();

  // 2. Clash Rules
  const clashTarget =
    target === "DIRECT"
      ? "DIRECT"
      : target === "BLOCK"
      ? "REJECT"
      : target === "UNLOCK_OUT"
      ? "🤖 AI & 流媒体解锁"
      : "🚀 节点选择";

  const clashRules: string[] = [];
  (rule.domains || []).forEach((d) => {
    const cleanDomain = d.replace(/^domain:/, "").replace(/^\*\./, "");
    clashRules.push(`DOMAIN-SUFFIX,${cleanDomain},${clashTarget}`);
  });
  (rule.geosite || []).forEach((g) => {
    const cleanGeo = g.replace(/^geosite:/, "");
    clashRules.push(`GEOSITE,${cleanGeo},${clashTarget}`);
  });
  (rule.geoip || []).forEach((g) => {
    const cleanGeo = g.replace(/^geoip:/, "").toUpperCase();
    clashRules.push(`GEOIP,${cleanGeo},${clashTarget}`);
  });
  (rule.ips || []).forEach((ip) => {
    clashRules.push(`IP-CIDR,${ip},${clashTarget},no-resolve`);
  });
  (rule.protocol || []).forEach((p) => {
    if (p === "bittorrent") clashRules.push(`PROCESS-NAME,BitTorrent,${clashTarget}`);
  });
  if (clashRules.length === 0) {
    clashRules.push(`MATCH,${clashTarget}`);
  }

  // 3. Sing-box JSON
  // sing-box 1.12+: geosite/geoip fields were removed in favour of rule_set; block is a rule action
  const singboxRule: any =
    target === "BLOCK" ? { action: "reject" } : { outbound: target === "DIRECT" ? "direct" : target === "UNLOCK_OUT" ? "unlock" : "select" };
  const ruleSets = [
    ...(rule.geosite || []).map((g) => `geosite-${g.replace(/^geosite:/, "").toLowerCase()}`),
    ...(rule.geoip || []).map((g) => `geoip-${g.replace(/^geoip:/, "").toLowerCase()}`),
  ];
  if (ruleSets.length > 0) singboxRule.rule_set = ruleSets;
  if (rule.domains && rule.domains.length > 0) singboxRule.domain_suffix = rule.domains;
  if (rule.ips && rule.ips.length > 0) singboxRule.ip_cidr = rule.ips;
  if (rule.port && rule.port.trim()) singboxRule.port = rule.port.trim();

  return {
    xray: JSON.stringify(xrayRule, null, 2),
    clash: clashRules.join("\n"),
    singbox: JSON.stringify(singboxRule, null, 2),
  };
}

