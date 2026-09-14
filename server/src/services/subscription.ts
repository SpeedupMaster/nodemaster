import YAML from "yaml";
import { NodeItem, RelayLink } from "../types/index.js";

// Helper to construct VLESS URL
export function toVlessUrl(node: NodeItem, customHost?: string, customPort?: number, aliasName?: string): string {
  if (!node.reality) return "";
  const host = customHost || node.ip;
  const port = customPort || node.port;
  const name = encodeURIComponent(aliasName || node.name);
  const r = node.reality;

  return `vless://${r.uuid}@${host}:${port}?type=tcp&security=reality&pbk=${r.publicKey}&fp=${r.fingerprint}&sni=${r.serverName}&sid=${r.shortId}&spx=%2F&flow=${r.flow}#${name}`;
}

// Generate Clash Meta / Mihomo Proxy Object
export function toClashProxy(node: NodeItem, customHost?: string, customPort?: number, aliasName?: string) {
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

// Build Active Proxies List considering Relays
export function assembleProxies(nodes: NodeItem[], relays: RelayLink[]) {
  const result: { node: NodeItem; host: string; port: number; name: string }[] = [];

  // 1. Direct Exit Nodes
  for (const n of nodes) {
    if (n.status !== "offline" && n.type === "exit" && n.reality) {
      result.push({
        node: n,
        host: n.ip,
        port: n.port,
        name: n.name,
      });
    }
  }

  // 2. Relay Chains (Transit -> Exit)
  for (const r of relays) {
    if (r.status !== "active") continue;
    const transit = nodes.find(n => n.id === r.transitNodeId);
    const exit = nodes.find(n => n.id === r.exitNodeId);
    if (transit && exit && exit.reality) {
      result.push({
        node: exit,
        host: transit.ip,
        port: r.transitPort,
        name: `⚡ ${r.name}`,
      });
    }
  }

  return result;
}

// Render Clash / Mihomo YAML Configuration
export function renderClashYaml(proxiesData: ReturnType<typeof assembleProxies>): string {
  const proxies = proxiesData
    .map(p => toClashProxy(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const proxyNames = proxies.map((p: any) => p.name);
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
    rules: [
      "DOMAIN-SUFFIX,openai.com,🤖 AI Service",
      "DOMAIN-SUFFIX,anthropic.com,🤖 AI Service",
      "DOMAIN-SUFFIX,claude.ai,🤖 AI Service",
      "DOMAIN-SUFFIX,chatgpt.com,🤖 AI Service",
      "DOMAIN-SUFFIX,youtube.com,📺 流媒体视频",
      "DOMAIN-SUFFIX,netflix.com,📺 流媒体视频",
      "GEOSITE,category-ai-chat-!cn,🤖 AI Service",
      "GEOSITE,netflix,📺 流媒体视频",
      "GEOSITE,youtube,📺 流媒体视频",
      "GEOIP,private,🎯 全球直连,no-resolve",
      "GEOSITE,cn,🎯 全球直连",
      "GEOIP,CN,🎯 全球直连",
      "MATCH,🐟 漏网之鱼",
    ],
  };

  return YAML.stringify(config);
}

// Render Sing-box JSON Configuration
export function renderSingboxJson(proxiesData: ReturnType<typeof assembleProxies>): string {
  const outbounds = proxiesData
    .map(p => toSingboxOutbound(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const tags = outbounds.map((o: any) => o.tag);

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
  };

  return JSON.stringify(singboxConfig, null, 2);
}

// Render Base64 / Standard VLESS URL List
export function renderBase64(proxiesData: ReturnType<typeof assembleProxies>): string {
  const urls = proxiesData
    .map(p => toVlessUrl(p.node, p.host, p.port, p.name))
    .filter(Boolean);

  const raw = urls.join("\n");
  return Buffer.from(raw, "utf-8").toString("base64");
}
