import type { RoutingRule } from "../types/index.js";

// Built-in shunting rules, applied in order by the Xray server config and the sing-box subscription.
// Clash and Egern subscriptions ship their own service-categorised rule templates instead.
export const ROUTING_RULES: readonly RoutingRule[] = [
  {
    id: "rule-private-lan",
    name: "私有局域网与回环",
    targetOutbound: "DIRECT",
    geosite: ["private"],
    geoip: ["private"],
    ips: ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
  },
  { id: "rule-block-p2p", name: "BitTorrent / P2P 防封拦截", targetOutbound: "BLOCK", protocol: ["bittorrent"] },
  {
    id: "rule-ai-services",
    name: "AI 办公全家桶 (OpenAI / Claude / Gemini)",
    targetOutbound: "UNLOCK_OUT",
    geosite: ["openai", "anthropic", "category-ai-chat-!cn"],
    domains: ["openai.com", "chatgpt.com", "oaistatic.com", "oaiusercontent.com", "claude.ai", "anthropic.com", "gemini.google.com"],
  },
  {
    id: "rule-global-streaming",
    name: "全球主流流媒体解锁",
    targetOutbound: "UNLOCK_OUT",
    geosite: ["netflix", "disney", "youtube", "tiktok", "spotify"],
    domains: ["netflix.com", "disneyplus.com", "youtube.com", "tiktok.com"],
  },
  { id: "rule-telegram", name: "Telegram 海外即时通讯", targetOutbound: "PROXY", geosite: ["telegram"], geoip: ["telegram"] },
  { id: "rule-cn-direct", name: "中国大陆流量直连", targetOutbound: "DIRECT", geosite: ["cn"], geoip: ["cn"] },
  // No conditions: documents the final match; generators emit it as their default outbound.
  { id: "rule-fallback", name: "漏网之鱼兜底 (Final Match)", targetOutbound: "PROXY" },
];

const strip = (value: string, prefix: string) => value.replace(new RegExp(`^${prefix}:`), "");

/** Bare names without `geosite:` / `geoip:` / `domain:` prefixes, as used by Clash and sing-box. */
export function plainConditions(rule: RoutingRule) {
  return {
    geosite: (rule.geosite || []).map((g) => strip(g, "geosite").toLowerCase()),
    geoip: (rule.geoip || []).map((g) => strip(g, "geoip").toLowerCase()),
    domains: (rule.domains || []).map((d) => strip(d, "domain").replace(/^\*\./, "")),
    ips: rule.ips || [],
  };
}

/** Xray matcher lists: prefixed domain/geosite entries and geoip/CIDR entries. */
export function xrayConditions(rule: RoutingRule) {
  const plain = plainConditions(rule);
  return {
    domain: [...plain.geosite.map((g) => `geosite:${g}`), ...plain.domains.map((d) => `domain:${d}`)],
    ip: [...plain.geoip.map((g) => `geoip:${g}`), ...plain.ips],
  };
}
