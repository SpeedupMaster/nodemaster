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

// Generate the Xray server-side config.json for a node
export function generateXrayServerConfig(node: NodeItem, targetExitNode?: NodeItem, transitPort = 10443) {
  if (node.type === "transit" && targetExitNode) {
    // Dokodemo-door transit inbound -> exit node outbound
    return {
      log: { loglevel: "warning" },
      dns: { servers: ["1.1.1.1", "8.8.8.8"] },
      inbounds: [
        {
          tag: `DOKODEMO_RELAY_${node.id}`,
          listen: "0.0.0.0",
          port: transitPort,
          protocol: "dokodemo",
          settings: {
            address: targetExitNode.ip,
            port: targetExitNode.port,
            network: "tcp,udp",
          },
        },
      ],
      outbounds: [
        {
          tag: "DIRECT",
          protocol: "freedom",
        },
      ],
    };
  }

  // Standard Exit node with VLESS-Reality
  const reality = node.reality || generateRealityCredentials();
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
    outbounds: [
      {
        tag: "DIRECT",
        protocol: "freedom",
      },
      {
        tag: "BLOCK",
        protocol: "blackhole",
      },
    ],
    routing: {
      domainStrategy: "AsIs",
      rules: [
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
      ],
    },
  };
}
