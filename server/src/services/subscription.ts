import fs from "fs";
import YAML from "yaml";
import type { NodeItem, RelayLink } from "../types/index.js";
import { asset } from "../paths.js";
import { ROUTING_RULES, plainConditions } from "./routingRules.js";

export interface AssembledProxy {
  node: NodeItem;
  host: string;
  port: number;
  name: string;
  targetCountry?: string;
  // Entry authenticates with the relay's chain client, i.e. its traffic is routed via the unlock node
  chain?: boolean;
}

/**
 * Subscription entries: every online VLESS-Reality node, plus one 🔗 entry per active relay.
 * Shadowsocks unlock nodes are never listed directly: plain SS is easily detected and blocked, so they
 * are only reachable through a main node.
 */
export function assembleProxies(nodes: NodeItem[], relays: RelayLink[]): AssembledProxy[] {
  const result: AssembledProxy[] = [];
  for (const n of nodes) {
    if (n.status === "online" && n.protocol === "vless-reality" && n.reality) {
      result.push({ node: n, host: n.ip, port: n.port, name: n.name, targetCountry: n.country });
    }
  }
  for (const r of relays) {
    if (r.status !== "active") continue;
    const main = nodes.find((n) => n.id === r.mainNodeId);
    const unlock = nodes.find((n) => n.id === r.unlockNodeId);
    if (main?.status === "online" && unlock?.status === "online" && main.reality && r.chainUuid) {
      result.push({
        // Same server, different credentials: the main node routes this client through UNLOCK_OUT
        node: { ...main, reality: { ...main.reality, uuid: r.chainUuid } },
        host: main.ip,
        port: main.port,
        name: `🔗 ${r.name || `${main.name} ➔ ${unlock.name} 解锁`}`,
        targetCountry: unlock.country || unlock.countryName,
        chain: true,
      });
    }
  }
  // Clash/Mihomo reject duplicate proxy names, and every format uses the name as the selector key
  const seen = new Set<string>();
  for (const p of result) {
    let name = p.name;
    for (let i = 2; seen.has(name); i++) name = `${p.name} ${i}`;
    seen.add(name);
    p.name = name;
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Per-format proxy entries
// ---------------------------------------------------------------------------------------------

function toUri({ node, host, port, name }: AssembledProxy): string {
  const label = encodeURIComponent(name);
  if (node.protocol === "shadowsocks" && node.shadowsocks) {
    const auth = Buffer.from(`${node.shadowsocks.method}:${node.shadowsocks.password}`).toString("base64");
    return `ss://${auth}@${host}:${port}#${label}`;
  }
  const r = node.reality!;
  const query = new URLSearchParams({ type: "tcp", security: "reality", pbk: r.publicKey, fp: r.fingerprint, sni: r.serverName, sid: r.shortId, spx: "/", flow: r.flow });
  return `vless://${r.uuid}@${host}:${port}?${query}#${label}`;
}

function toClashProxy({ node, host, port, name }: AssembledProxy) {
  if (node.protocol === "shadowsocks" && node.shadowsocks) {
    return { name, type: "ss", server: host, port, cipher: node.shadowsocks.method, password: node.shadowsocks.password, udp: true };
  }
  const r = node.reality!;
  return {
    name,
    type: "vless",
    server: host,
    port,
    uuid: r.uuid,
    network: "tcp",
    tls: true,
    "reality-opts": { "public-key": r.publicKey, "short-id": r.shortId },
    servername: r.serverName,
    flow: r.flow,
    "client-fingerprint": r.fingerprint,
  };
}

function toSingboxOutbound({ node, host, port, name }: AssembledProxy) {
  if (node.protocol === "shadowsocks" && node.shadowsocks) {
    return { type: "shadowsocks", tag: name, server: host, server_port: port, method: node.shadowsocks.method, password: node.shadowsocks.password };
  }
  const r = node.reality!;
  return {
    type: "vless",
    tag: name,
    server: host,
    server_port: port,
    uuid: r.uuid,
    flow: r.flow,
    network: "tcp",
    tls: {
      enabled: true,
      server_name: r.serverName,
      reality: { enabled: true, public_key: r.publicKey, short_id: r.shortId },
      utls: { enabled: true, fingerprint: r.fingerprint },
    },
  };
}

function toEgernProxy({ node, host, port, name }: AssembledProxy) {
  if (node.protocol === "shadowsocks" && node.shadowsocks) {
    return { shadowsocks: { name, server: host, port, method: node.shadowsocks.method, password: node.shadowsocks.password, udp_relay: true } };
  }
  const r = node.reality!;
  return {
    vless: {
      name,
      server: host,
      port,
      user_id: r.uuid,
      flow: r.flow,
      udp_relay: true,
      transport: { tls: { sni: r.serverName, reality: { public_key: r.publicKey, short_id: r.shortId } } },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Region grouping (by country code first: panel node names often carry no region tag)
// ---------------------------------------------------------------------------------------------

const US_NAME = /(\bUS\b|\bUSA\b|\[US\]|United States|美国|洛杉矶|硅谷|旧金山|西雅图|纽约|达拉斯|芝加哥|凤凰城|波特兰)/i;
const APAC_NAME = /(\bHK\b|\bJP\b|\bSG\b|\bTW\b|\bKR\b|\[HK\]|\[JP\]|\[SG\]|\[TW\]|\[KR\]|香港|日本|东京|大阪|新加坡|狮城|台湾|台北|韩国|首尔|亚太|Hong Kong|Japan|Singapore|Taiwan|Korea)/i;
const EU_NAME = /(\bUK\b|\bGB\b|\bDE\b|\bFR\b|\bRU\b|\bNL\b|\bEUR\b|\[UK\]|\[GB\]|\[DE\]|\[FR\]|\[RU\]|\[NL\]|英国|伦敦|德国|法兰克福|法国|巴黎|俄罗斯|莫斯科|荷兰|阿姆斯特丹|欧洲|Britain|London|Germany|Frankfurt|France|Paris|Russia|Moscow|Netherlands)/i;

const REGIONS = {
  美国节点: (name: string, c: string) => ["US", "USA"].includes(c) || US_NAME.test(name),
  亚太节点: (name: string, c: string) => ["HK", "JP", "SG", "TW", "KR", "MO"].includes(c) || APAC_NAME.test(name),
  欧洲节点: (name: string, c: string) =>
    !REGIONS.美国节点(name, c) && (["UK", "GB", "DE", "FR", "RU", "NL", "IT", "ES", "SE", "CH"].includes(c) || EU_NAME.test(name)),
};
type Region = keyof typeof REGIONS;
const REGION_NAMES = Object.keys(REGIONS) as Region[];

function inRegion(region: Region, p: AssembledProxy) {
  return REGIONS[region](p.name, (p.targetCountry || p.node.country || "").toUpperCase());
}
const namesIn = (region: Region, proxies: AssembledProxy[]) => proxies.filter((p) => inRegion(region, p)).map((p) => p.name);

// Service groups that should prefer the chained (unlock) entries when any exist
const UNLOCK_PREFERRED_GROUPS = new Set(["GPT", "Gemini", "Claude", "Copilot", "Grok", "Netflix", "Disney+"]);
const UNLOCK_GROUP = "解锁链路";

/**
 * A group that ends up empty must never fall back to DIRECT: rules route e.g. AI services to it, and
 * DIRECT would send that traffic from the user's own IP. REJECT only when there is no proxy at all.
 */
const nonEmpty = (names: string[], all: string[]) => (names.length ? names : all.length ? all : ["REJECT"]);

const readAsset = (name: string) => fs.readFileSync(asset(name), "utf-8");
let clashTemplate: string | undefined;
let egernRules: unknown[] | undefined;

// ---------------------------------------------------------------------------------------------
// Clash / Mihomo (service-categorised template shipped in clash-template.yaml)
// ---------------------------------------------------------------------------------------------

export function renderClashYaml(proxiesData: AssembledProxy[]): string {
  clashTemplate ??= readAsset("clash-template.yaml");
  const doc = YAML.parseDocument(clashTemplate);
  const proxyNames = proxiesData.map((p) => p.name);
  const chainNames = proxiesData.filter((p) => p.chain).map((p) => p.name);

  doc.set("proxies", doc.createNode(proxiesData.map(toClashProxy)));
  // The template's provider is a placeholder for manual use; an empty url makes clients error out
  if (!doc.getIn(["proxy-providers", "Primary-VPS", "url"])) doc.delete("proxy-providers");

  const groups = doc.get("proxy-groups") as YAML.YAMLSeq<YAML.YAMLMap>;
  for (const g of groups.items) {
    const name = String(g.get("name"));
    if (name === "手动选择") g.set("proxies", doc.createNode([...proxyNames, "DIRECT"]));
    else if (name === "自动选择") g.set("proxies", doc.createNode(nonEmpty(proxyNames, proxyNames)));

    if (g.has("filter") || name in REGIONS) {
      const filter = g.get("filter");
      const pattern = filter ? new RegExp(String(filter).replace(/^\(\?i\)/, ""), "i") : null;
      const matched = proxiesData
        .filter((p) => pattern?.test(p.name) || (name in REGIONS && inRegion(name as Region, p)))
        .map((p) => p.name);
      // The list is now explicit; leaving include-all/filter would make the client re-filter by name
      g.delete("include-all");
      g.delete("filter");
      g.set("proxies", doc.createNode(nonEmpty(matched, proxyNames)));
    }

    if (chainNames.length && UNLOCK_PREFERRED_GROUPS.has(name)) {
      const current = ((g.get("proxies") as YAML.YAMLSeq | undefined)?.toJSON() as string[] | undefined) || [];
      g.set("proxies", doc.createNode([UNLOCK_GROUP, ...current.filter((n) => n !== UNLOCK_GROUP)]));
    }
  }
  if (chainNames.length) groups.items.push(doc.createNode({ name: UNLOCK_GROUP, type: "select", proxies: [...chainNames, "节点选择"] }) as YAML.YAMLMap);

  return doc.toString();
}

// ---------------------------------------------------------------------------------------------
// sing-box 1.12+ (rule_set, typed DNS servers, rule actions)
// ---------------------------------------------------------------------------------------------

const SINGBOX_RULE_SET_BASE = {
  geosite: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set",
  geoip: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set",
};

export function renderSingboxJson(proxiesData: AssembledProxy[]): string {
  const outbounds = proxiesData.map(toSingboxOutbound);
  const tags = outbounds.map((o) => o.tag);
  const chainTags = proxiesData.filter((p) => p.chain).map((p) => p.name);

  const ruleSets = new Map<string, object>();
  const ruleSetTag = (kind: "geosite" | "geoip", name: string) => {
    const tag = `${kind}-${name}`;
    if (!ruleSets.has(tag)) {
      ruleSets.set(tag, { tag, type: "remote", format: "binary", url: `${SINGBOX_RULE_SET_BASE[kind]}/${tag}.srs`, download_detour: "select" });
    }
    return tag;
  };

  const routeRules: object[] = [];
  for (const rule of ROUTING_RULES) {
    const { geosite, geoip, domains, ips } = plainConditions(rule);
    const match: Record<string, unknown> = {};
    const sets = [...geosite.map((g) => ruleSetTag("geosite", g)), ...geoip.filter((g) => g !== "private").map((g) => ruleSetTag("geoip", g))];
    if (sets.length) match.rule_set = sets;
    if (geoip.includes("private")) match.ip_is_private = true;
    if (domains.length) match.domain_suffix = domains;
    if (ips.length) match.ip_cidr = ips;
    if (rule.protocol?.length) match.protocol = rule.protocol;
    if (!Object.keys(match).length) continue;

    const action =
      rule.targetOutbound === "DIRECT" ? { outbound: "direct" }
      : rule.targetOutbound === "BLOCK" ? { action: "reject" }
      : rule.targetOutbound === "UNLOCK_OUT" && chainTags.length ? { outbound: "unlock" }
      : { outbound: "select" };
    routeRules.push({ ...match, ...action });
  }
  const cnSite = ruleSetTag("geosite", "cn");
  const cnIp = ruleSetTag("geoip", "cn");

  const config = {
    log: { level: "warn" },
    // DNS anti-leak: everything is resolved by a foreign DoH server through the proxy, except
    // geosite:cn, which uses the domestic resolver directly. hijack-dns below makes sure the
    // system resolver cannot bypass this.
    dns: {
      servers: [
        { type: "https", tag: "dns-remote", server: "1.1.1.1", detour: "select" },
        { type: "https", tag: "dns-direct", server: "223.5.5.5" },
      ],
      rules: [{ rule_set: [cnSite], server: "dns-direct" }],
      final: "dns-remote",
      strategy: "prefer_ipv4",
    },
    inbounds: [
      { type: "tun", tag: "tun-in", address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"], auto_route: true, strict_route: true, stack: "mixed" },
      { type: "mixed", tag: "mixed-in", listen: "127.0.0.1", listen_port: 7890 },
    ],
    outbounds: [
      { type: "selector", tag: "select", outbounds: ["auto", ...(chainTags.length ? ["unlock"] : []), ...tags, "direct"] },
      { type: "urltest", tag: "auto", outbounds: tags.length ? tags : ["direct"], url: "https://www.gstatic.com/generate_204" },
      ...(chainTags.length ? [{ type: "selector", tag: "unlock", outbounds: [...chainTags, "select"] }] : []),
      ...outbounds,
      { type: "direct", tag: "direct" },
    ],
    route: {
      rules: [
        { action: "sniff" },
        { protocol: "dns", action: "hijack-dns" },
        { ip_is_private: true, outbound: "direct" },
        ...routeRules,
        { rule_set: [cnSite, cnIp], outbound: "direct" },
      ],
      rule_set: [...ruleSets.values()],
      final: "select",
      auto_detect_interface: true,
      // Resolves proxy server hostnames; node addresses are normally IPs
      default_domain_resolver: "dns-direct",
    },
    experimental: { cache_file: { enabled: true } },
  };
  return JSON.stringify(config, null, 2);
}

// ---------------------------------------------------------------------------------------------
// Egern (policy groups built here, rule list shipped in egern-rules.yaml)
// ---------------------------------------------------------------------------------------------

export function renderEgernYaml(proxiesData: AssembledProxy[], subUrl?: string): string {
  egernRules ??= YAML.parse(readAsset("egern-rules.yaml")) as unknown[];
  const proxyNames = proxiesData.map((p) => p.name);
  const chainNames = proxiesData.filter((p) => p.chain).map((p) => p.name);
  const regions = REGION_NAMES.filter((r) => namesIn(r, proxiesData).length > 0);
  const unlock = chainNames.length ? [UNLOCK_GROUP] : [];

  const select = (name: string, policies: string[], extra: object = {}) => ({ select: { name, policies, ...extra } });
  const autoTest = (name: string, policies: string[], interval: number) => ({ auto_test: { name, policies, interval, tolerance: 50, timeout: 5 } });

  const aiPreferred = [...unlock, ...regions.filter((r) => r === "美国节点"), "自动选择", ...regions.filter((r) => r !== "美国节点"), "手动选择", "节点选择"];
  const standardPreferred = ["节点选择", "自动选择", ...regions, "手动选择", "DIRECT"];
  const policyGroups = [
    select("节点选择", ["自动选择", ...regions, ...unlock, "手动选择", "DIRECT"], { icon: "globe" }),
    autoTest("自动选择", nonEmpty(proxyNames, proxyNames), 300),
    select("手动选择", [...proxyNames, "DIRECT"]),
    ...regions.map((r) => autoTest(r, namesIn(r, proxiesData), 600)),
    ...(chainNames.length ? [select(UNLOCK_GROUP, [...chainNames, "节点选择"])] : []),
    ...["GPT", "Gemini", "Claude", "Copilot", "Grok", "谷歌服务"].map((g) => select(g, aiPreferred)),
    ...["YouTube", "Netflix", "Disney+", "Spotify", "TikTok"].map((g) => select(g, UNLOCK_PREFERRED_GROUPS.has(g) ? [...unlock, ...standardPreferred] : standardPreferred)),
    ...["Telegram", "Twitter", "Facebook", "GitHub", "Speedtest"].map((g) => select(g, standardPreferred)),
    select("苹果服务", ["DIRECT", "自动选择", ...regions, "手动选择", "节点选择", "REJECT"]),
    select("微软服务", ["节点选择", "自动选择", "DIRECT", ...regions, "手动选择", "REJECT"]),
    select("广告拦截", ["REJECT", "DIRECT"]),
  ];

  const config = {
    ipv6: false,
    http_port: 3080,
    socks_port: 3090,
    allow_external_connections: false,
    block_quic: false,
    close_connections_on_policy_change: true,
    dns: {
      bootstrap: ["system"],
      upstreams: {
        google: ["https://8.8.8.8/dns-query", "https://8.8.4.4/dns-query"],
        alidns: ["https://223.5.5.5/dns-query", "https://223.6.6.6/dns-query"],
      },
      forward: [
        { domain_suffix: { match: "cn", value: "alidns" } },
        { wildcard: { match: "*.cn", value: "alidns" } },
        { wildcard: { match: "*", value: "google" } },
      ],
    },
    proxies: proxiesData.map(toEgernProxy),
    policy_groups: policyGroups,
    rules: egernRules,
    ...(subUrl ? { auto_update: { url: subUrl, interval: 86400 } } : {}),
  };
  return YAML.stringify(config, { aliasDuplicateObjects: false });
}

// ---------------------------------------------------------------------------------------------
// Base64 URI list (Shadowrocket / v2rayN / Quantumult X)
// ---------------------------------------------------------------------------------------------

export function renderBase64(proxiesData: AssembledProxy[]): string {
  return Buffer.from(proxiesData.map(toUri).join("\n"), "utf-8").toString("base64");
}
