import crypto from "crypto";
import { NodeItem, XrayRealityConfig } from "../types/index.js";

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

// Generate the Xray server-side config.json for a node (including chained unlock proxy)
export function generateXrayServerConfig(
  node: NodeItem,
  targetUnlockNode?: NodeItem,
  unlockMode: "ai_media" | "all" = "ai_media"
) {
  const reality = node.reality || generateRealityCredentials();

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

  // If paired with an Unlock Node, append UNLOCK_OUT outbound (VLESS-Reality egress chain)
  if (targetUnlockNode && targetUnlockNode.reality) {
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
        inboundTag: [`VLESS_REALITY_${node.id}`],
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

  return {
    log: {
      loglevel: "warning",
    },
    dns: {
      servers: ["1.1.1.1", "8.8.8.8"],
    },
    inbounds: [
      {
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
      },
    ],
    outbounds,
    routing: {
      domainStrategy: "AsIs",
      rules: routingRules,
    },
  };
}
