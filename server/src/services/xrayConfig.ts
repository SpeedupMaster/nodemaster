import crypto from "crypto";
import { NodeItem, XrayRealityConfig, ShadowsocksConfig } from "../types/index.js";

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

  // Routing rules
  const routingRules: any[] = [
    {
      type: "field",
      ip: ["geoip:private"],
      outboundTag: "BLOCK",
    },
    {
      type: "field",
      domain: ["geosite:private"],
      outboundTag: "BLOCK",
    },
    {
      type: "field",
      protocol: ["bittorrent"],
      outboundTag: "BLOCK",
    },
  ];

  // Inject Chained Unlock Routing Rules
  if (targetUnlockNode) {
    if (unlockMode === "all") {
      // All traffic routed through unlock node
      routingRules.push({
        type: "field",
        inboundTag: [`VLESS_REALITY_${node.id}`, `SS_${node.id}`],
        outboundTag: "UNLOCK_OUT",
      });
    } else {
      // AI and Streaming services domain unlock
      routingRules.push({
        type: "field",
        domain: [
          "geosite:openai",
          "geosite:anthropic",
          "geosite:netflix",
          "geosite:disney",
          "geosite:spotify",
          "geosite:tiktok",
          "domain:oaistatic.com",
          "domain:oaiusercontent.com",
          "domain:claude.ai",
        ],
        outboundTag: "UNLOCK_OUT",
      });
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

