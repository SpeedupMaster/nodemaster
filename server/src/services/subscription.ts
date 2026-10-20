import fs from "fs";
import YAML from "yaml";
import { NodeItem, RelayLink } from "../types/index.js";
import { db } from "../db/index.js";
import { asset } from "../paths.js";

const CLASH_TEMPLATE_PATH = asset("clash-template.yaml");

// Helper to construct VLESS URL
export function toVlessUrl(node: NodeItem, customHost?: string, customPort?: number, aliasName?: string): string {
  if (!node.reality) return "";
  const host = customHost || node.ip;
  const port = customPort || node.port;
  const name = encodeURIComponent(aliasName || node.name);
  const r = node.reality;

  return `vless://${r.uuid}@${host}:${port}?type=tcp&security=reality&pbk=${r.publicKey}&fp=${r.fingerprint}&sni=${r.serverName}&sid=${r.shortId}&spx=%2F&flow=${r.flow}#${name}`;
}

// Helper to construct Shadowsocks URL (SIP002 standard)
export function toSsUrl(node: NodeItem, customHost?: string, customPort?: number, aliasName?: string): string {
  if (!node.shadowsocks) return "";
  const host = customHost || node.ip;
  const port = customPort || node.port;
  const name = encodeURIComponent(aliasName || node.name);
  const auth = Buffer.from(`${node.shadowsocks.method}:${node.shadowsocks.password}`).toString("base64");
  return `ss://${auth}@${host}:${port}#${name}`;
}

// Generate Clash Meta / Mihomo Proxy Object
export function toClashProxy(node: NodeItem, customHost?: string, customPort?: number, aliasName?: string) {
  if (node.protocol === "shadowsocks" && node.shadowsocks) {
    return {
      name: aliasName || node.name,
      type: "ss",
      server: customHost || node.ip,
      port: customPort || node.port,
      cipher: node.shadowsocks.method,
      password: node.shadowsocks.password,
      udp: true,
    };
  }

  if (!node.reality) return null;
  const r = node.reality;

  return {
    name: aliasName || node.name,
    type: "vless",
    server: customHost || node.ip,
    port: customPort || node.port,
    uuid: r.uuid,
    network: "tcp",
    tls: true,
    "reality-opts": {
      "public-key": r.publicKey,
      "short-id": r.shortId,
    },
    servername: r.serverName,
    flow: r.flow,
    "client-fingerprint": r.fingerprint,
  };
}

// Generate Sing-box Outbound Object
export function toSingboxOutbound(node: NodeItem, customHost?: string, customPort?: number, aliasName?: string) {
  if (node.protocol === "shadowsocks" && node.shadowsocks) {
    return {
      type: "shadowsocks",
      tag: aliasName || node.name,
      server: customHost || node.ip,
      server_port: customPort || node.port,
      method: node.shadowsocks.method,
      password: node.shadowsocks.password,
    };
  }

  if (!node.reality) return null;
  const r = node.reality;

  return {
    type: "vless",
    tag: aliasName || node.name,
    server: customHost || node.ip,
    server_port: customPort || node.port,
    uuid: r.uuid,
    flow: r.flow,
    network: "tcp",
    tls: {
      enabled: true,
      server_name: r.serverName,
      reality: {
        enabled: true,
        public_key: r.publicKey,
        short_id: r.shortId,
      },
      utls: {
        enabled: true,
        fingerprint: r.fingerprint,
      },
    },
  };
}

export interface AssembledProxy {
  node: NodeItem;
  host: string;
  port: number;
  name: string;
  targetCountry?: string;
  // Entry authenticates with the relay's chain client, i.e. its traffic is routed via the unlock node
  chain?: boolean;
}

// Build Active Proxies List considering Relays and Chained Unlock Nodes
export function assembleProxies(nodes: NodeItem[], relays: RelayLink[]) {
  const result: AssembledProxy[] = [];

  // 1. 仅将安全的主力直连节点 (VLESS-Reality 等免证书抗封锁协议) 作为单节点加入订阅
  // 落地节点是 SS 协议 (Shadowsocks/Unlock)，直连极易被 GFW 主动探测并封锁，因此在直连订阅中隐藏，仅通过链式中转提供
  for (const n of nodes) {
    const isNakedUnlock = n.protocol === "shadowsocks" || n.type === "unlock" || n.type === "exit";
    if (n.status === "online" && !isNakedUnlock && n.reality) {
      result.push({
        node: n,
        host: n.ip,
        port: n.port,
        name: n.name,
        targetCountry: n.country,
      });
    }
  }

  // 2. 链式解锁节点对 (主力直连机 -> 落地解锁机)
  // 客户端直连主力机 (VLESS-Reality 安全抗封锁)，由主力机在海外访问落地机，安全解锁流媒体与 AI
  for (const r of relays) {
    if (r.status !== "active") continue;
    const mainId = r.mainNodeId || r.transitNodeId;
    const unlockId = r.unlockNodeId || r.exitNodeId;
    const main = nodes.find((n) => n.id === mainId);
    const unlock = nodes.find((n) => n.id === unlockId);
    if (main && unlock && main.status === "online" && unlock.status === "online" && main.reality && r.chainUuid) {
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

const REGION_MATCHERS: Record<string, (name: string, country?: string) => boolean> = {
  美国节点: (name, country) => isUSNode(name, country),
  亚太节点: (name, country) => isAPACNode(name, country),
  欧洲节点: (name, country) => isEUNode(name, country),
};
// Template groups that should prefer the chained (unlock) entries when any exist
const UNLOCK_PREFERRED_GROUPS = new Set(["GPT", "Gemini", "Claude", "Copilot", "Grok", "Netflix", "Disney+"]);
const UNLOCK_GROUP = "解锁链路";

function proxyCountry(p: AssembledProxy) {
  return p.targetCountry || p.node.country;
}

// Render Clash / Mihomo YAML Configuration (Service-Categorized High-Spec Template)
export function renderClashYaml(proxiesData: AssembledProxy[]): string {
  const proxies = proxiesData
    .map(p => toClashProxy(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const proxyNames = proxies.map((p: any) => p.name);
  const chainNames = proxiesData.filter((p) => p.chain).map((p) => p.name);
  // A group that ends up empty must never fall back to DIRECT: the rules route e.g. AI services to
  // it, and DIRECT would send that traffic from the user's own IP. REJECT only when there is no proxy.
  const nonEmpty = (names: string[]) => (names.length > 0 ? names : proxyNames.length > 0 ? proxyNames : ["REJECT"]);

  // If clash-template.yaml exists, use the full service-single-provider.yaml template
  if (fs.existsSync(CLASH_TEMPLATE_PATH)) {
    try {
      const templateStr = fs.readFileSync(CLASH_TEMPLATE_PATH, "utf-8");
      const doc = YAML.parseDocument(templateStr);

      // 1. Inject all proxies
      doc.set("proxies", doc.createNode(proxies));

      // 2. Remove empty Primary-VPS provider to avoid "url can not be empty" errors
      const providers = doc.get("proxy-providers") as any;
      if (providers && providers.get && providers.get("Primary-VPS")) {
        const p = providers.get("Primary-VPS");
        if (!p.get("url")) {
          doc.delete("proxy-providers");
        }
      }

      // 3. Update proxy groups to include explicit node names for universal compatibility
      const groups = doc.get("proxy-groups") as any;
      if (groups && groups.items) {
        for (let i = 0; i < groups.items.length; i++) {
          const g = groups.items[i];
          const name = g.get("name");

          if (name === "手动选择" || name === "🌎 Global-Manual") {
            g.set("proxies", doc.createNode([...proxyNames, "DIRECT"]));
          } else if (name === "自动选择") {
            g.set("proxies", doc.createNode(nonEmpty(proxyNames)));
          }

          const filter = g.get("filter");
          const regionMatcher = REGION_MATCHERS[name];
          if (filter || regionMatcher) {
            let matched: string[] = [];
            try {
              const reg = filter ? new RegExp(String(filter).replace(/^\(\?i\)/, ""), "i") : null;
              // Match the node's country as well as its name: panel node names often carry no region tag
              matched = proxiesData
                .filter((p) => (reg && reg.test(p.name)) || (regionMatcher && regionMatcher(p.name, proxyCountry(p))))
                .map((p) => p.name);
            } catch (e) {
              // Ignore regex errors
            }
            // The list is now explicit; leaving include-all/filter would make the client re-filter by name
            g.delete("include-all");
            g.delete("filter");
            g.set("proxies", doc.createNode(nonEmpty(matched)));
          }

          if (chainNames.length > 0 && UNLOCK_PREFERRED_GROUPS.has(name)) {
            const current = (g.get("proxies")?.toJSON?.() as string[] | undefined) || [];
            g.set("proxies", doc.createNode([UNLOCK_GROUP, ...current.filter((n) => n !== UNLOCK_GROUP)]));
          }
        }

        if (chainNames.length > 0) {
          groups.items.push(
            doc.createNode({ name: UNLOCK_GROUP, type: "select", proxies: [...chainNames, "节点选择"] })
          );
        }
      }

      // 4. Inject active user-defined custom routing rules from panel (exclude built-in presets that are handled by dedicated template groups)
      const activeRules = db.getRoutingRules().filter((r) => r.enabled && !r.builtInPresetId);
      const allNodes = db.getNodes();
      const customClashRules: string[] = [];

      for (const rule of activeRules) {
        let target = "节点选择";
        if (rule.targetOutbound === "DIRECT") target = "DIRECT";
        else if (rule.targetOutbound === "BLOCK") target = "REJECT";
        else if (rule.targetOutbound === "UNLOCK_OUT") target = chainNames.length > 0 ? UNLOCK_GROUP : "节点选择";
        else if (rule.targetOutbound === "PROXY") {
          if (rule.targetNodeId) {
            const tgtNode = allNodes.find((n) => n.id === rule.targetNodeId);
            if (tgtNode && proxyNames.includes(tgtNode.name)) target = tgtNode.name;
          }
        }

        if (rule.domains) {
          rule.domains.forEach((d) => {
            const cleanDomain = d.replace(/^domain:/, "").replace(/^\*\./, "");
            customClashRules.push(`DOMAIN-SUFFIX,${cleanDomain},${target}`);
          });
        }
        if (rule.geosite) {
          rule.geosite.forEach((g) => {
            const cleanGeo = g.replace(/^geosite:/, "");
            customClashRules.push(`GEOSITE,${cleanGeo},${target}`);
          });
        }
        if (rule.geoip) {
          rule.geoip.forEach((g) => {
            const cleanGeo = g.replace(/^geoip:/, "").toUpperCase();
            // no-resolve: an IP rule must not trigger a DNS lookup for domain requests
            customClashRules.push(`GEOIP,${cleanGeo},${target},no-resolve`);
          });
        }
        if (rule.ips) {
          rule.ips.forEach((ip) => {
            customClashRules.push(`IP-CIDR,${ip},${target},no-resolve`);
          });
        }
        if (rule.protocol?.includes("bittorrent")) {
          customClashRules.push(`PROCESS-NAME,BitTorrent,REJECT`);
        }
      }

      if (customClashRules.length > 0) {
        const rulesSeq = doc.get("rules") as any;
        if (rulesSeq && rulesSeq.items) {
          const lanIdx = rulesSeq.items.findIndex((item: any) => String(item).includes("GEOIP,LAN"));
          const insertPos = lanIdx >= 0 ? lanIdx + 1 : 0;
          const customNodes = customClashRules.map((r) => doc.createNode(r));
          rulesSeq.items.splice(insertPos, 0, ...customNodes);
        }
      }

      return doc.toString();
    } catch (err) {
      console.error("Failed to render custom Clash template, falling back to minimal:", err);
    }
  }

  // Fallback simplified configuration
  const pick = (matcher: (name: string, country?: string) => boolean) =>
    proxiesData.filter((p) => matcher(p.name, proxyCountry(p))).map((p) => p.name);
  const hkProxies = pick((n, c) => (c || "").toUpperCase() === "HK" || /HK|香港/i.test(n));
  const jpProxies = pick((n, c) => (c || "").toUpperCase() === "JP" || /JP|日本/i.test(n));
  const usProxies = pick(isUSNode);
  const aiProxies = chainNames.length > 0 ? chainNames : usProxies;

  const config = {
    "mixed-port": 7890,
    // Only this device may use the proxy port; LAN sharing is an explicit user choice
    "allow-lan": false,
    mode: "rule",
    "log-level": "info",
    ipv6: false,
    sniffer: {
      enable: true,
      sniff: {
        TLS: { ports: [443, 8443] },
        HTTP: { ports: [80, 8080] },
      },
    },
    // DNS anti-leak: queries follow the routing rules (respect-rules), so a proxied domain is resolved
    // through the proxy by a foreign resolver; only geosite:cn reaches the domestic resolver.
    dns: {
      enable: true,
      "enhanced-mode": "fake-ip",
      "fake-ip-range": "198.18.0.1/16",
      "respect-rules": true,
      "default-nameserver": ["223.5.5.5", "119.29.29.29"],
      nameserver: ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"],
      "nameserver-policy": { "geosite:cn,private": ["https://223.5.5.5/dns-query", "https://doh.pub/dns-query"] },
      "proxy-server-nameserver": ["https://223.5.5.5/dns-query", "https://doh.pub/dns-query"],
      "direct-nameserver": ["https://223.5.5.5/dns-query", "https://doh.pub/dns-query"],
    },
    proxies,
    "proxy-groups": [
      {
        name: "🚀 节点选择",
        type: "select",
        proxies: ["♻️ 自动选择", ...proxyNames, "DIRECT"],
      },
      {
        name: "♻️ 自动选择",
        type: "url-test",
        proxies: nonEmpty(proxyNames),
        url: "http://www.gstatic.com/generate_204",
        interval: 300,
        tolerance: 50,
      },
      {
        name: "🤖 AI Service",
        type: "select",
        proxies: [...aiProxies, "🚀 节点选择"],
      },
      {
        name: "📺 流媒体视频",
        type: "select",
        proxies: ["🚀 节点选择", ...chainNames, ...hkProxies, ...jpProxies],
      },
      ...(hkProxies.length > 0 ? [{ name: "🇭🇰 香港节点", type: "url-test", proxies: hkProxies, url: "http://www.gstatic.com/generate_204", interval: 300 }] : []),
      ...(jpProxies.length > 0 ? [{ name: "🇯🇵 日本节点", type: "url-test", proxies: jpProxies, url: "http://www.gstatic.com/generate_204", interval: 300 }] : []),
      ...(usProxies.length > 0 ? [{ name: "🇺🇸 美国节点", type: "url-test", proxies: usProxies, url: "http://www.gstatic.com/generate_204", interval: 300 }] : []),
      {
        name: "🎯 全球直连",
        type: "select",
        proxies: ["DIRECT"],
      },
      {
        name: "🐟 漏网之鱼",
        type: "select",
        proxies: ["🚀 节点选择", "DIRECT"],
      },
    ],
    rules: (() => {
      const activeRules = db.getRoutingRules().filter((r) => r.enabled);
      const clashRules: string[] = [];

      for (const rule of activeRules) {
        let target = "🚀 节点选择";
        if (rule.targetOutbound === "DIRECT") target = "🎯 全球直连";
        else if (rule.targetOutbound === "BLOCK") target = "REJECT";
        else if (rule.targetOutbound === "UNLOCK_OUT") {
          target = rule.name.includes("AI") ? "🤖 AI Service" : "📺 流媒体视频";
        }

        if (rule.domains) {
          rule.domains.forEach((d) => {
            const cleanDomain = d.replace(/^domain:/, "").replace(/^\*\./, "");
            clashRules.push(`DOMAIN-SUFFIX,${cleanDomain},${target}`);
          });
        }
        if (rule.geosite) {
          rule.geosite.forEach((g) => {
            const cleanGeo = g.replace(/^geosite:/, "");
            clashRules.push(`GEOSITE,${cleanGeo},${target}`);
          });
        }
        if (rule.geoip) {
          rule.geoip.forEach((g) => {
            const cleanGeo = g.replace(/^geoip:/, "").toUpperCase();
            clashRules.push(`GEOIP,${cleanGeo},${target},no-resolve`);
          });
        }
        if (rule.ips) {
          rule.ips.forEach((ip) => {
            clashRules.push(`IP-CIDR,${ip},${target},no-resolve`);
          });
        }
        if (rule.protocol?.includes("bittorrent")) {
          clashRules.push(`PROCESS-NAME,BitTorrent,REJECT`);
        }
      }

      if (clashRules.length === 0) {
        clashRules.push(
          "GEOSITE,category-ai-chat-!cn,🤖 AI Service",
          "GEOSITE,netflix,📺 流媒体视频",
          "GEOIP,private,🎯 全球直连,no-resolve",
          "GEOSITE,cn,🎯 全球直连",
          "GEOIP,CN,🎯 全球直连,no-resolve"
        );
      }
      clashRules.push("MATCH,🐟 漏网之鱼");
      return clashRules;
    })(),
  };

  return YAML.stringify(config);
}

const SINGBOX_GEOSITE_URL = "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set";
const SINGBOX_GEOIP_URL = "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set";

// "443", "80,443", "1000-2000" → sing-box port / port_range fields
function singboxPorts(spec: string) {
  const port: number[] = [];
  const port_range: string[] = [];
  for (const part of spec.split(",").map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*[-:]\s*(\d+)$/);
    if (range) port_range.push(`${range[1]}:${range[2]}`);
    else if (/^\d+$/.test(part)) port.push(Number(part));
  }
  return { ...(port.length ? { port } : {}), ...(port_range.length ? { port_range } : {}) };
}

// Render Sing-box JSON Configuration (sing-box 1.12+ format: rule_set, typed DNS servers, rule actions)
export function renderSingboxJson(proxiesData: AssembledProxy[]): string {
  const outbounds = proxiesData
    .map((p) => toSingboxOutbound(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const tags = outbounds.map((o: any) => o.tag);
  const chainTags = proxiesData.filter((p) => p.chain).map((p) => p.name);

  const ruleSets = new Map<string, { tag: string; type: "remote"; format: "binary"; url: string; download_detour: string }>();
  const ruleSetTag = (kind: "geosite" | "geoip", name: string) => {
    const clean = name.replace(/^(geosite|geoip):/, "").toLowerCase();
    const tag = `${kind}-${clean}`;
    if (!ruleSets.has(tag)) {
      const base = kind === "geosite" ? SINGBOX_GEOSITE_URL : SINGBOX_GEOIP_URL;
      ruleSets.set(tag, { tag, type: "remote", format: "binary", url: `${base}/${tag}.srs`, download_detour: "select" });
    }
    return tag;
  };

  const routeRules: any[] = [];
  for (const rule of db.getRoutingRules().filter((r) => r.enabled)) {
    let action: Record<string, unknown>;
    if (rule.targetOutbound === "DIRECT") action = { outbound: "direct" };
    else if (rule.targetOutbound === "BLOCK") action = { action: "reject" };
    else if (rule.targetOutbound === "UNLOCK_OUT") action = { outbound: chainTags.length > 0 ? "unlock" : "select" };
    else action = { outbound: "select" };

    const geoipNames = (rule.geoip || []).map((g) => g.replace(/^geoip:/, "").toLowerCase());
    const sRule: any = {};
    const sets = [
      ...(rule.geosite || []).map((g) => ruleSetTag("geosite", g)),
      ...geoipNames.filter((g) => g !== "private").map((g) => ruleSetTag("geoip", g)),
    ];
    if (sets.length > 0) sRule.rule_set = sets;
    if (geoipNames.includes("private")) sRule.ip_is_private = true;
    if (rule.domains && rule.domains.length > 0) {
      sRule.domain_suffix = rule.domains.map((d) => d.replace(/^domain:/, "").replace(/^\*\./, ""));
    }
    if (rule.ips && rule.ips.length > 0) sRule.ip_cidr = rule.ips;
    if (rule.port && rule.port.trim()) Object.assign(sRule, singboxPorts(rule.port));
    if (rule.protocol?.includes("bittorrent")) sRule.protocol = ["bittorrent"];

    if (Object.keys(sRule).length > 0) routeRules.push({ ...sRule, ...action });
  }
  const cnSite = ruleSetTag("geosite", "cn");
  const cnIp = ruleSetTag("geoip", "cn");

  const singboxConfig = {
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
      {
        type: "tun",
        tag: "tun-in",
        address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
        auto_route: true,
        strict_route: true,
        stack: "mixed",
      },
      { type: "mixed", tag: "mixed-in", listen: "127.0.0.1", listen_port: 7890 },
    ],
    outbounds: [
      {
        type: "selector",
        tag: "select",
        outbounds: ["auto", ...(chainTags.length > 0 ? ["unlock"] : []), ...tags, "direct"],
      },
      {
        type: "urltest",
        tag: "auto",
        outbounds: tags.length ? tags : ["direct"],
        url: "https://www.gstatic.com/generate_204",
      },
      ...(chainTags.length > 0 ? [{ type: "selector", tag: "unlock", outbounds: [...chainTags, "select"] }] : []),
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
      rule_set: Array.from(ruleSets.values()),
      final: "select",
      auto_detect_interface: true,
      // Resolves proxy server hostnames; node addresses are normally IPs
      default_domain_resolver: "dns-direct",
    },
    experimental: { cache_file: { enabled: true } },
  };

  return JSON.stringify(singboxConfig, null, 2);
}

// Render Base64 / Standard URL List (VLESS & Shadowsocks)
export function renderBase64(proxiesData: AssembledProxy[]): string {
  const urls = proxiesData
    .map(p =>
      p.node.protocol === "shadowsocks"
        ? toSsUrl(p.node, p.host, p.port, p.name)
        : toVlessUrl(p.node, p.host, p.port, p.name)
    )
    .filter(Boolean);

  const raw = urls.join("\n");
  return Buffer.from(raw, "utf-8").toString("base64");
}

// Helper functions for region identification
function isUSNode(name: string, country?: string): boolean {
  const c = (country || "").toUpperCase();
  if (c === "US" || c === "USA") return true;
  return /(\bUS\b|\bUSA\b|\[US\]|United States|美国|洛杉矶|硅谷|旧金山|西雅图|纽约|达拉斯|芝加哥|凤凰城|波特兰)/i.test(name);
}

function isAPACNode(name: string, country?: string): boolean {
  const c = (country || "").toUpperCase();
  if (["HK", "JP", "SG", "TW", "KR", "MO"].includes(c)) return true;
  return /(\bHK\b|\bJP\b|\bSG\b|\bTW\b|\bKR\b|\[HK\]|\[JP\]|\[SG\]|\[TW\]|\[KR\]|香港|日本|东京|大阪|新加坡|狮城|台湾|台北|韩国|首尔|亚太|Hong Kong|Japan|Singapore|Taiwan|Korea)/i.test(name);
}

function isEUNode(name: string, country?: string): boolean {
  if (isUSNode(name, country)) return false;
  const c = (country || "").toUpperCase();
  if (["UK", "GB", "DE", "FR", "RU", "NL", "IT", "ES", "SE", "CH"].includes(c)) return true;
  return /(\bUK\b|\bGB\b|\bDE\b|\bFR\b|\bRU\b|\bNL\b|\bEUR\b|\[UK\]|\[GB\]|\[DE\]|\[FR\]|\[RU\]|\[NL\]|英国|伦敦|德国|法兰克福|法国|巴黎|俄罗斯|莫斯科|荷兰|阿姆斯特丹|欧洲|Britain|London|Germany|Frankfurt|France|Paris|Russia|Moscow|Netherlands)/i.test(name);
}

// Generate Egern Proxy Object
export function toEgernProxy(node: NodeItem, customHost?: string, customPort?: number, aliasName?: string) {
  const name = aliasName || node.name;
  const server = customHost || node.ip;
  const port = customPort || node.port;

  if (node.protocol === "shadowsocks" && node.shadowsocks) {
    return {
      shadowsocks: {
        name,
        server,
        port,
        method: node.shadowsocks.method,
        password: node.shadowsocks.password,
        udp_relay: true,
      },
    };
  }

  if (node.reality) {
    const r = node.reality;
    const tlsConfig: any = {
      sni: r.serverName || "www.microsoft.com",
      reality: {
        public_key: r.publicKey,
      },
    };
    if (r.shortId) {
      tlsConfig.reality.short_id = r.shortId;
    }

    return {
      vless: {
        name,
        server,
        port,
        user_id: r.uuid,
        flow: r.flow || "xtls-rprx-vision",
        udp_relay: true,
        transport: {
          tls: tlsConfig,
        },
      },
    };
  }

  return null;
}

// Render Egern YAML Configuration
export function renderEgernYaml(proxiesData: AssembledProxy[], subUrl?: string): string {
  const proxies = proxiesData
    .map(p => toEgernProxy(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const proxyNames = proxiesData.map(p => p.name);

  const usProxies = proxiesData.filter(p => isUSNode(p.name, p.targetCountry || p.node.country)).map(p => p.name);
  const apacProxies = proxiesData.filter(p => isAPACNode(p.name, p.targetCountry || p.node.country)).map(p => p.name);
  const euProxies = proxiesData.filter(p => isEUNode(p.name, p.targetCountry || p.node.country)).map(p => p.name);

  // Policy groups
  const policyGroups: any[] = [
    {
      select: {
        name: "节点选择",
        policies: [
          "自动选择",
          ...(usProxies.length > 0 ? ["美国节点"] : []),
          ...(apacProxies.length > 0 ? ["亚太节点"] : []),
          ...(euProxies.length > 0 ? ["欧洲节点"] : []),
          "手动选择",
          "DIRECT",
        ],
        icon: "globe",
      },
    },
    {
      auto_test: {
        name: "自动选择",
        policies: proxyNames.length > 0 ? proxyNames : ["DIRECT"],
        interval: 300,
        tolerance: 50,
        timeout: 5,
      },
    },
    {
      select: {
        name: "手动选择",
        policies: [...proxyNames, "DIRECT"],
      },
    },
  ];

  if (usProxies.length > 0) {
    policyGroups.push({
      auto_test: {
        name: "美国节点",
        policies: usProxies,
        interval: 600,
        tolerance: 50,
        timeout: 5,
      },
    });
  }

  if (apacProxies.length > 0) {
    policyGroups.push({
      auto_test: {
        name: "亚太节点",
        policies: apacProxies,
        interval: 600,
        tolerance: 50,
        timeout: 5,
      },
    });
  }

  if (euProxies.length > 0) {
    policyGroups.push({
      auto_test: {
        name: "欧洲节点",
        policies: euProxies,
        interval: 600,
        tolerance: 50,
        timeout: 5,
      },
    });
  }

  // 专线候选组
  const aiPreferred = [
    ...(usProxies.length > 0 ? ["美国节点"] : []),
    "自动选择",
    ...(apacProxies.length > 0 ? ["亚太节点"] : []),
    ...(euProxies.length > 0 ? ["欧洲节点"] : []),
    "手动选择",
    "节点选择",
    "DIRECT",
  ];

  const standardPreferred = [
    "节点选择",
    "自动选择",
    ...(apacProxies.length > 0 ? ["亚太节点"] : []),
    ...(usProxies.length > 0 ? ["美国节点"] : []),
    ...(euProxies.length > 0 ? ["欧洲节点"] : []),
    "手动选择",
    "DIRECT",
  ];

  const aiGroups = ["GPT", "Gemini", "Claude", "Copilot", "Grok", "谷歌服务"];
  for (const gName of aiGroups) {
    policyGroups.push({
      select: {
        name: gName,
        policies: [...aiPreferred],
      },
    });
  }

  const mediaGroups = ["YouTube", "Netflix", "Disney+", "Spotify", "TikTok", "Telegram", "Twitter", "Facebook", "GitHub"];
  for (const gName of mediaGroups) {
    policyGroups.push({
      select: {
        name: gName,
        policies: [...standardPreferred],
      },
    });
  }

  policyGroups.push({
    select: {
      name: "苹果服务",
      policies: [
        "DIRECT",
        "自动选择",
        ...(apacProxies.length > 0 ? ["亚太节点"] : []),
        ...(usProxies.length > 0 ? ["美国节点"] : []),
        ...(euProxies.length > 0 ? ["欧洲节点"] : []),
        "手动选择",
        "节点选择",
        "REJECT",
      ],
    },
  });

  policyGroups.push({
    select: {
      name: "微软服务",
      policies: [
        "节点选择",
        "自动选择",
        "DIRECT",
        ...(apacProxies.length > 0 ? ["亚太节点"] : []),
        ...(usProxies.length > 0 ? ["美国节点"] : []),
        ...(euProxies.length > 0 ? ["欧洲节点"] : []),
        "手动选择",
        "REJECT",
      ],
    },
  });

  policyGroups.push({
    select: {
      name: "Speedtest",
      policies: [...standardPreferred],
    },
  });

  policyGroups.push({
    select: {
      name: "广告拦截",
      policies: ["REJECT", "DIRECT"],
    },
  });

  // 注入面板自定义路由规则（排除已被细分策略组覆盖的内置预设）
  const activeRules = db.getRoutingRules().filter((r) => r.enabled && !r.builtInPresetId);
  const allNodes = db.getNodes();
  const customEgernRules: any[] = [];

  for (const rule of activeRules) {
    let target = "节点选择";
    if (rule.targetOutbound === "DIRECT") target = "DIRECT";
    else if (rule.targetOutbound === "BLOCK") target = "REJECT";
    else if (rule.targetOutbound === "UNLOCK_OUT") target = "美国节点";
    else if (rule.targetOutbound === "PROXY") {
      if (rule.targetNodeId) {
        const tgtNode = allNodes.find((n) => n.id === rule.targetNodeId);
        if (tgtNode) target = tgtNode.name;
      }
    }

    if (rule.domains) {
      rule.domains.forEach((d) => {
        const cleanDomain = d.replace(/^domain:/, "").replace(/^\*\./, "");
        customEgernRules.push({
          domain_suffix: {
            match: cleanDomain,
            policy: target,
          },
        });
      });
    }

    if (rule.geoip) {
      rule.geoip.forEach((g) => {
        const cleanGeo = g.replace(/^geoip:/, "").toUpperCase();
        customEgernRules.push({
          geoip: {
            match: cleanGeo,
            policy: target,
            no_resolve: true,
          },
        });
      });
    }

    if (rule.ips) {
      rule.ips.forEach((ip) => {
        customEgernRules.push({
          ip_cidr: {
            match: ip,
            policy: target,
          },
        });
      });
    }
  }

  const rules: any[] = [
    // 本地局域网
    { ip_cidr: { match: "10.0.0.0/8", policy: "DIRECT" } },
    { ip_cidr: { match: "127.0.0.0/8", policy: "DIRECT" } },
    { ip_cidr: { match: "172.16.0.0/12", policy: "DIRECT" } },
    { ip_cidr: { match: "192.168.0.0/16", policy: "DIRECT" } },
    { ip_cidr: { match: "100.64.0.0/10", policy: "DIRECT" } },

    // 用户自定义规则
    ...customEgernRules,

    // AI 服务
    { domain_suffix: { match: "openai.com", policy: "GPT" } },
    { domain_suffix: { match: "chatgpt.com", policy: "GPT" } },
    { domain_suffix: { match: "oaistatic.com", policy: "GPT" } },
    { domain_suffix: { match: "oaiusercontent.com", policy: "GPT" } },
    { domain_suffix: { match: "anthropic.com", policy: "Claude" } },
    { domain_suffix: { match: "claude.ai", policy: "Claude" } },
    { domain_suffix: { match: "bard.google.com", policy: "Gemini" } },
    { domain_suffix: { match: "gemini.google.com", policy: "Gemini" } },
    { domain_suffix: { match: "generativelanguage.googleapis.com", policy: "Gemini" } },
    { domain_suffix: { match: "copilot.microsoft.com", policy: "Copilot" } },
    { domain_suffix: { match: "githubcopilot.com", policy: "Copilot" } },
    { domain_suffix: { match: "x.ai", policy: "Grok" } },
    { domain_suffix: { match: "grok.com", policy: "Grok" } },

    // 流媒体
    { domain_suffix: { match: "youtube.com", policy: "YouTube" } },
    { domain_suffix: { match: "youtu.be", policy: "YouTube" } },
    { domain_suffix: { match: "ytimg.com", policy: "YouTube" } },
    { domain_suffix: { match: "googlevideo.com", policy: "YouTube" } },
    { domain_suffix: { match: "netflix.com", policy: "Netflix" } },
    { domain_suffix: { match: "netflix.net", policy: "Netflix" } },
    { domain_suffix: { match: "nflximg.net", policy: "Netflix" } },
    { domain_suffix: { match: "nflxvideo.net", policy: "Netflix" } },
    { domain_suffix: { match: "nflxext.com", policy: "Netflix" } },
    { domain_suffix: { match: "disneyplus.com", policy: "Disney+" } },
    { domain_suffix: { match: "dssott.com", policy: "Disney+" } },
    { domain_suffix: { match: "spotify.com", policy: "Spotify" } },
    { domain_suffix: { match: "scdn.co", policy: "Spotify" } },
    { domain_suffix: { match: "tiktok.com", policy: "TikTok" } },
    { domain_suffix: { match: "byteoversea.com", policy: "TikTok" } },
    { domain_suffix: { match: "ibytedtos.com", policy: "TikTok" } },

    // 社交
    { domain_suffix: { match: "telegram.org", policy: "Telegram" } },
    { domain_suffix: { match: "t.me", policy: "Telegram" } },
    { domain_suffix: { match: "tdlib.com", policy: "Telegram" } },
    { ip_cidr: { match: "91.108.4.0/22", policy: "Telegram" } },
    { ip_cidr: { match: "91.108.8.0/22", policy: "Telegram" } },
    { ip_cidr: { match: "91.108.56.0/22", policy: "Telegram" } },
    { ip_cidr: { match: "149.154.160.0/20", policy: "Telegram" } },
    { domain_suffix: { match: "twitter.com", policy: "Twitter" } },
    { domain_suffix: { match: "x.com", policy: "Twitter" } },
    { domain_suffix: { match: "twimg.com", policy: "Twitter" } },
    { domain_suffix: { match: "facebook.com", policy: "Facebook" } },
    { domain_suffix: { match: "fbcdn.net", policy: "Facebook" } },
    { domain_suffix: { match: "instagram.com", policy: "Facebook" } },
    { domain_suffix: { match: "github.com", policy: "GitHub" } },
    { domain_suffix: { match: "githubusercontent.com", policy: "GitHub" } },

    // 谷歌服务
    { domain_suffix: { match: "google.com", policy: "谷歌服务" } },
    { domain_suffix: { match: "google.com.hk", policy: "谷歌服务" } },
    { domain_suffix: { match: "googleapis.com", policy: "谷歌服务" } },
    { domain_suffix: { match: "gstatic.com", policy: "谷歌服务" } },

    // 苹果服务
    { domain_suffix: { match: "apple.com", policy: "苹果服务" } },
    { domain_suffix: { match: "icloud.com", policy: "苹果服务" } },
    { domain_suffix: { match: "itunes.com", policy: "苹果服务" } },
    { domain_suffix: { match: "mzstatic.com", policy: "苹果服务" } },
    { domain_suffix: { match: "aaplimg.com", policy: "苹果服务" } },
    { domain_suffix: { match: "apple-cloudkit.com", policy: "苹果服务" } },
    { domain_suffix: { match: "apple-livephotoskit.com", policy: "苹果服务" } },
    { domain_suffix: { match: "cdn-apple.com", policy: "苹果服务" } },
    { domain_suffix: { match: "icloud-content.com", policy: "苹果服务" } },
    { domain_suffix: { match: "me.com", policy: "苹果服务" } },
    { domain_suffix: { match: "apple-dns.net", policy: "苹果服务" } },

    // 微软服务
    { domain_suffix: { match: "microsoft.com", policy: "微软服务" } },
    { domain_suffix: { match: "office.com", policy: "微软服务" } },
    { domain_suffix: { match: "office365.com", policy: "微软服务" } },
    { domain_suffix: { match: "live.com", policy: "微软服务" } },
    { domain_suffix: { match: "bing.com", policy: "微软服务" } },
    { domain_suffix: { match: "msn.com", policy: "微软服务" } },
    { domain_suffix: { match: "windows.com", policy: "微软服务" } },
    { domain_suffix: { match: "windowsupdate.com", policy: "微软服务" } },
    { domain_suffix: { match: "azure.com", policy: "微软服务" } },
    { domain_suffix: { match: "onedrive.com", policy: "微软服务" } },
    { domain_suffix: { match: "sharepoint.com", policy: "微软服务" } },
    { domain_suffix: { match: "skype.com", policy: "微软服务" } },
    { domain_suffix: { match: "xbox.com", policy: "微软服务" } },

    // Speedtest
    { domain_suffix: { match: "speedtest.net", policy: "Speedtest" } },
    { domain_suffix: { match: "ookla.com", policy: "Speedtest" } },

    // 广告拦截
    { domain_suffix: { match: "doubleclick.net", policy: "广告拦截" } },
    { domain_suffix: { match: "googleadservices.com", policy: "广告拦截" } },
    { domain_suffix: { match: "daumtools.com", policy: "广告拦截" } },

    // 中国大陆常见域名与 GeoIP 直连
    { domain_suffix: { match: "cn", policy: "DIRECT" } },
    { domain_suffix: { match: "qq.com", policy: "DIRECT" } },
    { domain_suffix: { match: "wechat.com", policy: "DIRECT" } },
    { domain_suffix: { match: "weixin.com", policy: "DIRECT" } },
    { domain_suffix: { match: "alipay.com", policy: "DIRECT" } },
    { domain_suffix: { match: "aliyun.com", policy: "DIRECT" } },
    { domain_suffix: { match: "taobao.com", policy: "DIRECT" } },
    { domain_suffix: { match: "tmall.com", policy: "DIRECT" } },
    { domain_suffix: { match: "jd.com", policy: "DIRECT" } },
    { domain_suffix: { match: "bilibili.com", policy: "DIRECT" } },
    { domain_suffix: { match: "baidu.com", policy: "DIRECT" } },
    { domain_suffix: { match: "163.com", policy: "DIRECT" } },
    { domain_suffix: { match: "126.net", policy: "DIRECT" } },
    { domain_suffix: { match: "sina.com.cn", policy: "DIRECT" } },
    { domain_suffix: { match: "zhihu.com", policy: "DIRECT" } },
    { geoip: { match: "CN", policy: "DIRECT", no_resolve: true } },

    // 兜底
    { default: { policy: "节点选择" } },
  ];

  const config: any = {
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
    proxies,
    policy_groups: policyGroups,
    rules,
  };

  if (subUrl) {
    config.auto_update = {
      url: subUrl,
      interval: 86400,
    };
  }

  return YAML.stringify(config, { aliasDuplicateObjects: false });
}


