import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { NodeItem, RelayLink } from "../types/index.js";
import { db } from "../db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLASH_TEMPLATE_PATH = path.resolve(__dirname, "../../data/clash-template.yaml");

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

// Build Active Proxies List considering Relays and Chained Unlock Nodes
export function assembleProxies(nodes: NodeItem[], relays: RelayLink[]) {
  const result: { node: NodeItem; host: string; port: number; name: string }[] = [];

  // 1. All Direct & Unlock Nodes with valid Reality or Shadowsocks config
  for (const n of nodes) {
    if (n.status !== "offline" && (n.reality || n.shadowsocks)) {
      result.push({
        node: n,
        host: n.ip,
        port: n.port,
        name: n.name,
      });
    }
  }

  // 2. Chained Unlock Pairs (Main Node -> Unlock Node)
  for (const r of relays) {
    if (r.status !== "active") continue;
    const mainId = r.mainNodeId || r.transitNodeId;
    const unlockId = r.unlockNodeId || r.exitNodeId;
    const main = nodes.find(n => n.id === mainId);
    const unlock = nodes.find(n => n.id === unlockId);
    if (main && unlock && (main.reality || main.shadowsocks)) {
      result.push({
        node: main,
        host: main.ip,
        port: main.port,
        name: `🔗 ${r.name || `${main.name} ➔ ${unlock.name} 解锁`}`,
      });
    }
  }

  return result;
}

// Render Clash / Mihomo YAML Configuration (Service-Categorized High-Spec Template)
export function renderClashYaml(proxiesData: ReturnType<typeof assembleProxies>): string {
  const proxies = proxiesData
    .map(p => toClashProxy(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const proxyNames = proxies.map((p: any) => p.name);

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
            g.set("proxies", doc.createNode(proxyNames.length > 0 ? proxyNames : ["DIRECT"]));
          }

          const filter = g.get("filter");
          if (filter) {
            try {
              const reg = new RegExp(String(filter).replace(/^\(\?i\)/, ""), "i");
              const matched = proxyNames.filter((pName: string) => reg.test(pName));
              g.set("proxies", doc.createNode(matched.length > 0 ? matched : ["DIRECT"]));
            } catch (e) {
              // Ignore regex errors
            }
          }
        }
      }

      // 4. Inject active custom routing rules from panel
      const activeRules = db.getRoutingRules().filter((r) => r.enabled);
      const allNodes = db.getNodes();
      const customClashRules: string[] = [];

      for (const rule of activeRules) {
        let target = "节点选择";
        if (rule.targetOutbound === "DIRECT") target = "DIRECT";
        else if (rule.targetOutbound === "BLOCK") target = "REJECT";
        else if (rule.targetOutbound === "PROXY") {
          if (rule.targetNodeId) {
            const tgtNode = allNodes.find((n) => n.id === rule.targetNodeId);
            if (tgtNode) target = tgtNode.name;
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
            customClashRules.push(`GEOIP,${cleanGeo},${target}${cleanGeo === "PRIVATE" ? ",no-resolve" : ""}`);
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
  const hkProxies = proxyNames.filter(n => /HK|香港/i.test(n));
  const jpProxies = proxyNames.filter(n => /JP|日本/i.test(n));
  const usProxies = proxyNames.filter(n => /US|美国/i.test(n));

  const config = {
    "mixed-port": 7890,
    "allow-lan": true,
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
    dns: {
      enable: true,
      "enhanced-mode": "fake-ip",
      "fake-ip-range": "198.18.0.1/16",
      nameserver: ["https://223.5.5.5/dns-query", "https://1.1.1.1/dns-query"],
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
        proxies: proxyNames.length > 0 ? proxyNames : ["DIRECT"],
        url: "http://www.gstatic.com/generate_204",
        interval: 300,
        tolerance: 50,
      },
      {
        name: "🤖 AI Service",
        type: "select",
        proxies: usProxies.length > 0 ? [...usProxies, "🚀 节点选择"] : ["🚀 节点选择"],
      },
      {
        name: "📺 流媒体视频",
        type: "select",
        proxies: ["🚀 节点选择", ...(hkProxies.length ? hkProxies : []), ...(jpProxies.length ? jpProxies : [])],
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
            clashRules.push(`GEOIP,${cleanGeo},${target}${cleanGeo === "PRIVATE" ? ",no-resolve" : ""}`);
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
          "GEOIP,CN,🎯 全球直连"
        );
      }
      clashRules.push("MATCH,🐟 漏网之鱼");
      return clashRules;
    })(),
  };

  return YAML.stringify(config);
}

// Render Sing-box JSON Configuration
export function renderSingboxJson(proxiesData: ReturnType<typeof assembleProxies>): string {
  const outbounds = proxiesData
    .map((p) => toSingboxOutbound(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const tags = outbounds.map((o: any) => o.tag);

  // Generate singbox route rules
  const activeRules = db.getRoutingRules().filter((r) => r.enabled);
  const routeRules: any[] = [];

  for (const rule of activeRules) {
    let outbound = "select";
    if (rule.targetOutbound === "DIRECT") outbound = "direct";
    else if (rule.targetOutbound === "BLOCK") outbound = "block";
    else if (rule.targetOutbound === "UNLOCK_OUT") outbound = "auto";

    const sRule: any = { outbound };
    if (rule.geosite && rule.geosite.length > 0) sRule.geosite = rule.geosite;
    if (rule.domains && rule.domains.length > 0) {
      sRule.domain_suffix = rule.domains.map((d) => d.replace(/^domain:/, "").replace(/^\*\./, ""));
    }
    if (rule.geoip && rule.geoip.length > 0) sRule.geoip = rule.geoip;
    if (rule.ips && rule.ips.length > 0) sRule.ip_cidr = rule.ips;
    if (rule.port) sRule.port = rule.port;

    if (sRule.geosite || sRule.domain_suffix || sRule.geoip || sRule.ip_cidr || sRule.port) {
      routeRules.push(sRule);
    }
  }

  const singboxConfig = {
    dns: {
      servers: [
        { tag: "dns_proxy", address: "https://1.1.1.1/dns-query", address_resolver: "dns_direct" },
        { tag: "dns_direct", address: "https://223.5.5.5/dns-query", detour: "direct" },
      ],
    },
    outbounds: [
      {
        type: "selector",
        tag: "select",
        outbounds: ["auto", ...tags, "direct"],
      },
      {
        type: "urltest",
        tag: "auto",
        outbounds: tags.length ? tags : ["direct"],
        url: "http://www.gstatic.com/generate_204",
      },
      ...outbounds,
      { type: "direct", tag: "direct" },
      { type: "block", tag: "block" },
    ],
    route: {
      rules: routeRules,
      auto_detect_interface: true,
    },
  };

  return JSON.stringify(singboxConfig, null, 2);
}

// Render Base64 / Standard URL List (VLESS & Shadowsocks)
export function renderBase64(proxiesData: ReturnType<typeof assembleProxies>): string {
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
export function renderEgernYaml(proxiesData: ReturnType<typeof assembleProxies>, subUrl?: string): string {
  const proxies = proxiesData
    .map(p => toEgernProxy(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const proxyNames = proxiesData.map(p => p.name);

  const usProxies = proxiesData.filter(p => isUSNode(p.name, p.node.country)).map(p => p.name);
  const apacProxies = proxiesData.filter(p => isAPACNode(p.name, p.node.country)).map(p => p.name);
  const euProxies = proxiesData.filter(p => isEUNode(p.name, p.node.country)).map(p => p.name);

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
    "自动选择",
    ...(apacProxies.length > 0 ? ["亚太节点"] : []),
    ...(usProxies.length > 0 ? ["美国节点"] : []),
    ...(euProxies.length > 0 ? ["欧洲节点"] : []),
    "手动选择",
    "节点选择",
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
      name: "广告拦截",
      policies: ["REJECT", "DIRECT"],
    },
  });

  // 注入面板自定义路由规则
  const activeRules = db.getRoutingRules().filter((r) => r.enabled);
  const allNodes = db.getNodes();
  const customEgernRules: any[] = [];

  for (const rule of activeRules) {
    let target = "节点选择";
    if (rule.targetOutbound === "DIRECT") target = "DIRECT";
    else if (rule.targetOutbound === "BLOCK") target = "REJECT";
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


