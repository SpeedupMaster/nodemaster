import crypto from "crypto";
import { NodeItem, XrayRealityConfig, ShadowsocksConfig, RoutingRule } from "../types/index.js";
import { db } from "../db/index.js";

// Helper to generate reality credentials
export function generateRealityCredentials(serverName = "www.microsoft.com"): XrayRealityConfig {
  const uuid = crypto.randomUUID();
  // Generate random 32-byte curve25519-like base64url keys
  const privBytes = crypto.randomBytes(32);
  const pubBytes = crypto.randomBytes(32);
  const privateKey = privBytes.toString("base64url");
  const publicKey = pubBytes.toString("base64url");
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
  return {
    method,
    // 16-byte base64 password is valid for 2022-blake3-aes-128-gcm and standard AEAD
    password: password || crypto.randomBytes(16).toString("base64"),
  };
}

// Generate the Xray server-side config.json for a node (including chained unlock proxy)
export function generateXrayServerConfig(
  node: NodeItem,
  targetUnlockNode?: NodeItem,
  unlockMode: "ai_media" | "all" = "ai_media"
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
              uot: true,
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

  // Dynamic Routing rules from DB
  const routingRules: any[] = [];

  if (targetUnlockNode && unlockMode === "all") {
    // All traffic routed through unlock node
    routingRules.push({
      type: "field",
      inboundTag: [`VLESS_REALITY_${node.id}`, `SS_${node.id}`],
      outboundTag: "UNLOCK_OUT",
    });
  } else {
    // Load active routing rules from database
    const activeRules = db.getRoutingRules().filter((r) => r.enabled);

    for (const rule of activeRules) {
      // If rule targets specific inbounds, check if current node is included
      if (
        rule.inboundNodeIds &&
        rule.inboundNodeIds.length > 0 &&
        !rule.inboundNodeIds.includes(node.id)
      ) {
        continue;
      }

      // Determine outbound tag
      let tag = rule.targetOutbound;
      if (tag === "UNLOCK_OUT") {
        tag = targetUnlockNode ? "UNLOCK_OUT" : "DIRECT";
      } else if (tag === "PROXY") {
        tag = targetUnlockNode ? "UNLOCK_OUT" : "DIRECT";
      }

      const fieldRule: any = {
        type: "field",
        outboundTag: tag,
      };

      // Collect domains & geosites
      const domains: string[] = [];
      if (rule.geosite && rule.geosite.length > 0) {
        rule.geosite.forEach((g) => {
          domains.push(g.startsWith("geosite:") ? g : `geosite:${g}`);
        });
      }
      if (rule.domains && rule.domains.length > 0) {
        rule.domains.forEach((d) => {
          domains.push(d.includes(":") ? d : `domain:${d}`);
        });
      }
      if (domains.length > 0) {
        fieldRule.domain = domains;
      }

      // Collect IPs & geoips
      const ips: string[] = [];
      if (rule.geoip && rule.geoip.length > 0) {
        rule.geoip.forEach((g) => {
          ips.push(g.startsWith("geoip:") ? g : `geoip:${g}`);
        });
      }
      if (rule.ips && rule.ips.length > 0) {
        rule.ips.forEach((ip) => {
          ips.push(ip);
        });
      }
      if (ips.length > 0) {
        fieldRule.ip = ips;
      }

      // Protocols
      if (rule.protocol && rule.protocol.length > 0) {
        fieldRule.protocol = rule.protocol;
      }

      // Port
      if (rule.port && rule.port.trim()) {
        fieldRule.port = rule.port.trim();
      }

      // If at least one matching condition exists, push rule
      if (fieldRule.domain || fieldRule.ip || fieldRule.protocol || fieldRule.port) {
        routingRules.push(fieldRule);
      } else if (
        rule.builtInPresetId === "preset_fallback" ||
        rule.name.includes("兜底") ||
        rule.name.includes("Fallback")
      ) {
        fieldRule.inboundTag = [`VLESS_REALITY_${node.id}`, `SS_${node.id}`];
        routingRules.push(fieldRule);
      }
    }
  }

  // Ensure fallback defaults if no routing rules matched
  if (routingRules.length === 0) {
    routingRules.push(
      { type: "field", ip: ["geoip:private"], outboundTag: "BLOCK" },
      { type: "field", domain: ["geosite:private"], outboundTag: "BLOCK" },
      { type: "field", protocol: ["bittorrent"], outboundTag: "BLOCK" }
    );
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
        flow: reality.flow || "xtls-rprx-vision",
        clients: [
          {
            id: reality.uuid,
            flow: reality.flow || "xtls-rprx-vision",
            email: "nodemaster_client@local",
          },
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
    inbounds,
    outbounds,
    routing: {
      domainStrategy: "AsIs",
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
  const singboxRule: any = {
    outbound: target.toLowerCase(),
  };
  if (rule.geosite && rule.geosite.length > 0) singboxRule.geosite = rule.geosite;
  if (rule.domains && rule.domains.length > 0) singboxRule.domain_suffix = rule.domains;
  if (rule.geoip && rule.geoip.length > 0) singboxRule.geoip = rule.geoip;
  if (rule.ips && rule.ips.length > 0) singboxRule.ip_cidr = rule.ips;
  if (rule.port && rule.port.trim()) singboxRule.port = rule.port.trim();

  return {
    xray: JSON.stringify(xrayRule, null, 2),
    clash: clashRules.join("\n"),
    singbox: JSON.stringify(singboxRule, null, 2),
  };
}

