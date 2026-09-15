import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { generateRealityCredentials, generateShadowsocksCredentials, generateXrayServerConfig } from "../services/xrayConfig.js";
import { assembleProxies, renderClashYaml, renderSingboxJson, renderBase64, toVlessUrl } from "../services/subscription.js";
import { wsHub } from "../services/wsHub.js";
import { NodeItem, RelayLink, ShadowsocksConfig, XrayRealityConfig } from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const apiRouter = Router();

// -------------------------------------------------------------
// 1. Node Management
// -------------------------------------------------------------
apiRouter.get("/nodes", (req, res) => {
  res.json({ success: true, data: db.getNodes() });
});

apiRouter.post("/nodes", (req, res) => {
  const { name, ip, port, type, protocol, country, countryName, trafficLimitBytes, tags, sni, serverName, ssMethod, ssPassword, bandwidthMbps, trafficResetDay } = req.body;
  
  if (!name || !ip) {
    return res.status(400).json({ success: false, message: "名称与 IP 为必填项" });
  }

  const isUnlock = type === "unlock" || protocol === "shadowsocks";
  const nodeProtocol = isUnlock ? "shadowsocks" : (protocol || "vless-reality");
  const targetPort = Number(port) || (isUnlock ? 8388 : 443);

  let reality: XrayRealityConfig | undefined;
  let shadowsocks: ShadowsocksConfig | undefined;

  if (nodeProtocol === "shadowsocks") {
    shadowsocks = generateShadowsocksCredentials(ssMethod, ssPassword);
  } else {
    const targetSni = (sni || serverName || "").trim() || "www.microsoft.com";
    reality = generateRealityCredentials(targetSni);
  }

  const id = `node-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const token = `tok_${crypto.randomBytes(16).toString("hex")}`;

  const defaultTags = isUnlock
    ? ["住宅IP", "Shadowsocks", "流媒体解锁"]
    : ["Xray", "Reality", "主力直连"];

  const newNode: NodeItem = {
    id,
    name,
    ip,
    port: targetPort,
    type: type || (isUnlock ? "unlock" : "direct"),
    protocol: nodeProtocol,
    status: "online",
    country: country || "US",
    countryName: countryName || (isUnlock ? "美国原生住宅" : "海外主力节点"),
    token,
    trafficUsedBytes: 0,
    trafficLimitBytes: Number(trafficLimitBytes) || (isUnlock ? 2147483648000 : 1073741824000), // 2TB or 1TB default
    uplinkSpeedBytes: 0,
    downlinkSpeedBytes: 0,
    cpuUsage: 5.0,
    memUsage: 15.0,
    diskUsage: 20.0,
    latencyMs: isUnlock ? 140 : 45,
    reality,
    shadowsocks,
    bandwidthMbps: Number(bandwidthMbps) || 1000,
    trafficResetDay: Math.min(31, Math.max(1, Number(trafficResetDay) || 1)),
    lastSeen: Date.now(),
    createdAt: Date.now(),
    tags: tags && tags.length > 0 ? tags : defaultTags,
    sni: !isUnlock ? (sni || "www.microsoft.com") : undefined,
  };

  db.addNode(newNode);
  wsHub.broadcastNodeUpdate(newNode.id);
  res.json({ success: true, data: newNode });
});

apiRouter.put("/nodes/:id", (req, res) => {
  const existing = db.getNodeById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: "节点不存在" });

  const {
    name,
    ip,
    port,
    country,
    countryName,
    trafficLimitBytes,
    trafficLimitGB,
    bandwidthMbps,
    trafficResetDay,
    tags,
    sni,
    ssMethod,
    ssPassword,
    status,
  } = req.body;

  const updates: Partial<NodeItem> = {};

  if (name !== undefined) updates.name = name;
  if (ip !== undefined) updates.ip = ip;
  if (port !== undefined) updates.port = Number(port) || existing.port;
  if (country !== undefined) updates.country = country;
  if (countryName !== undefined) updates.countryName = countryName;
  if (bandwidthMbps !== undefined) updates.bandwidthMbps = Number(bandwidthMbps) || existing.bandwidthMbps;
  if (trafficResetDay !== undefined) {
    updates.trafficResetDay = Math.min(31, Math.max(1, Number(trafficResetDay) || 1));
  }
  if (trafficLimitBytes !== undefined) {
    updates.trafficLimitBytes = Number(trafficLimitBytes);
  } else if (trafficLimitGB !== undefined) {
    updates.trafficLimitBytes = Number(trafficLimitGB) * 1024 * 1024 * 1024;
  }
  if (tags !== undefined) {
    updates.tags = Array.isArray(tags) ? tags : String(tags).split(/[,，]/).map(t => t.trim()).filter(Boolean);
  }
  if (status !== undefined) updates.status = status;

  // Protocol specific updates
  if (existing.protocol === "vless-reality" || existing.type === "direct") {
    if (sni !== undefined) {
      updates.sni = sni;
      if (existing.reality) {
        updates.reality = {
          ...existing.reality,
          serverName: sni,
        };
      }
    }
  } else if (existing.protocol === "shadowsocks" || existing.type === "unlock") {
    if (req.body.shadowsocks) {
      updates.shadowsocks = {
        method: req.body.shadowsocks.method || existing.shadowsocks?.method || "2022-blake3-aes-128-gcm",
        password: req.body.shadowsocks.password || existing.shadowsocks?.password || "",
      };
    } else if (ssMethod !== undefined || ssPassword !== undefined) {
      updates.shadowsocks = {
        method: ssMethod || existing.shadowsocks?.method || "2022-blake3-aes-128-gcm",
        password: ssPassword || existing.shadowsocks?.password || "",
      };
    }
  }

  const updated = db.updateNode(req.params.id, updates);
  if (!updated) return res.status(404).json({ success: false, message: "节点更新失败" });
  wsHub.broadcastNodeUpdate(updated.id);
  res.json({ success: true, data: updated });
});

apiRouter.delete("/nodes/:id", (req, res) => {
  const ok = db.deleteNode(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: "节点不存在" });
  wsHub.broadcastToWeb({ type: "NODE_DELETED", id: req.params.id });
  res.json({ success: true, message: "节点已删除" });
});

apiRouter.get("/nodes/:id/xray-config", (req, res) => {
  const node = db.getNodeById(req.params.id);
  if (!node) return res.status(404).json({ success: false, message: "节点不存在" });

  let targetUnlock: NodeItem | undefined;
  let unlockMode: "ai_media" | "all" = "ai_media";

  // Check if this node is paired with an Unlock Node
  const relay = db.getRelays().find(r => r.mainNodeId === node.id || r.transitNodeId === node.id);
  if (relay) {
    const unlockId = relay.unlockNodeId || relay.exitNodeId;
    if (unlockId) {
      targetUnlock = db.getNodeById(unlockId);
      unlockMode = relay.mode || "ai_media";
    }
  }

  const config = generateXrayServerConfig(node, targetUnlock, unlockMode);
  res.json({ success: true, data: config });
});

apiRouter.post("/nodes/:id/reset-traffic", (req, res) => {
  const updated = db.updateNode(req.params.id, {
    trafficUsedBytes: 0,
    status: "online",
  });
  if (!updated) return res.status(404).json({ success: false, message: "节点不存在" });
  wsHub.broadcastNodeUpdate(updated.id);
  res.json({ success: true, message: "流量已重置", data: updated });
});

// -------------------------------------------------------------
// 2. Chained Relays (链式代理与解锁拓扑)
// -------------------------------------------------------------
apiRouter.get("/relays", (req, res) => {
  res.json({ success: true, data: db.getRelays() });
});

apiRouter.post("/relays", (req, res) => {
  const { name, mainNodeId, unlockNodeId, mode, transitNodeId, exitNodeId } = req.body;
  const mainId = mainNodeId || transitNodeId;
  const unlockId = unlockNodeId || exitNodeId;

  if (!mainId || !unlockId) {
    return res.status(400).json({ success: false, message: "主力连接节点与目标解锁机为必选项" });
  }

  const newRelay: RelayLink = {
    id: `relay-${Date.now().toString(36)}`,
    name: name || "链式解锁代理",
    mainNodeId: mainId,
    unlockNodeId: unlockId,
    mode: mode || "ai_media",
    transitNodeId: mainId,
    exitNodeId: unlockId,
    transitPort: 443,
    status: "active",
    trafficBytes: 0,
    latencyMs: 35,
    createdAt: Date.now(),
  };

  db.addRelay(newRelay);
  wsHub.broadcastToWeb({ type: "RELAYS_UPDATE", relays: db.getRelays() });
  res.json({ success: true, data: newRelay });
});

apiRouter.delete("/relays/:id", (req, res) => {
  const ok = db.deleteRelay(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: "中转链路不存在" });
  wsHub.broadcastToWeb({ type: "RELAYS_UPDATE", relays: db.getRelays() });
  res.json({ success: true, message: "中转链路已删除" });
});

// -------------------------------------------------------------
// 3. Subscriptions (订阅管理)
// -------------------------------------------------------------
apiRouter.get("/subscriptions", (req, res) => {
  res.json({ success: true, data: db.getSubscriptions() });
});

apiRouter.post("/subscriptions", (req, res) => {
  const { name, nodeIds, trafficLimitBytes, expireAt } = req.body;
  const token = `sub_${crypto.randomBytes(12).toString("hex")}`;
  const newSub = {
    id: `sub-${Date.now().toString(36)}`,
    name: name || "专属订阅",
    token,
    nodeIds: nodeIds || [],
    trafficLimitBytes: Number(trafficLimitBytes) || 0,
    trafficUsedBytes: 0,
    expireAt: Number(expireAt) || 0,
    createdAt: Date.now(),
  };
  db.addSubscription(newSub);
  res.json({ success: true, data: newSub });
});

apiRouter.delete("/subscriptions/:id", (req, res) => {
  const ok = db.deleteSubscription(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: "订阅不存在" });
  res.json({ success: true, message: "订阅已删除" });
});

// -------------------------------------------------------------
// 4. Public Adaptive Subscription Endpoint
// -------------------------------------------------------------
apiRouter.get("/sub/:token", (req, res) => {
  const sub = db.getSubscriptionByToken(req.params.token);
  if (!sub) {
    return res.status(404).send("Subscription not found or expired.");
  }

  // Filter nodes if sub specifies nodeIds
  let allNodes = db.getNodes();
  if (sub.nodeIds && sub.nodeIds.length > 0) {
    allNodes = allNodes.filter(n => sub.nodeIds.includes(n.id));
  }

  const relays = db.getRelays();
  const proxies = assembleProxies(allNodes, relays);

  // Set standard subscription headers for Clash / Shadowrocket
  const usedGB = (sub.trafficUsedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const totalGB = sub.trafficLimitBytes ? (sub.trafficLimitBytes / (1024 * 1024 * 1024)).toFixed(0) : "∞";
  res.setHeader("Subscription-Userinfo", `upload=0; download=${sub.trafficUsedBytes}; total=${sub.trafficLimitBytes || 10000000000000}; expire=${sub.expireAt || 0}`);
  res.setHeader("profile-web-page-url", `${req.protocol}://${req.get("host")}`);

  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const explicitFormat = (req.query.format as string || "").toLowerCase();

  // Route format
  if (explicitFormat === "clash" || (!explicitFormat && (ua.includes("clash") || ua.includes("mihomo") || ua.includes("stash")))) {
    res.setHeader("Content-Type", "text/yaml; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="nodemaster_${sub.id}.yaml"; filename*=UTF-8''${encodeURIComponent(sub.name)}.yaml`);
    return res.send(renderClashYaml(proxies));
  }

  if (explicitFormat === "singbox" || (!explicitFormat && (ua.includes("sing-box") || ua.includes("singbox")))) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.send(renderSingboxJson(proxies));
  }

  // Default: Base64 URI list for Shadowrocket / v2rayN / Quantumult X
  return res.send(renderBase64(proxies));
});

// -------------------------------------------------------------
// 5. Node Query by Token & Telemetry Ingestion API
// -------------------------------------------------------------
apiRouter.get("/nodes/by-token/:token", (req, res) => {
  const node = db.getNodeByToken(req.params.token);
  if (!node) return res.status(404).json({ success: false, message: "Token 无效" });
  res.json({ success: true, data: node });
});

apiRouter.post("/nodes/telemetry", (req, res) => {
  const { token, ...telemetry } = req.body;
  if (!token) return res.status(400).json({ success: false, message: "缺少 token" });
  const node = db.getNodeByToken(token);
  if (!node) return res.status(404).json({ success: false, message: "节点不存在" });

  const updates: Partial<NodeItem> = {
    lastSeen: Date.now(),
    status: "online",
  };

  if (typeof telemetry.cpuUsage === "number") updates.cpuUsage = +telemetry.cpuUsage.toFixed(1);
  if (typeof telemetry.memUsage === "number") updates.memUsage = +telemetry.memUsage.toFixed(1);
  if (typeof telemetry.diskUsage === "number") updates.diskUsage = +telemetry.diskUsage.toFixed(1);
  if (typeof telemetry.memTotalBytes === "number") updates.memTotalBytes = telemetry.memTotalBytes;
  if (typeof telemetry.memUsedBytes === "number") updates.memUsedBytes = telemetry.memUsedBytes;
  if (typeof telemetry.diskTotalBytes === "number") updates.diskTotalBytes = telemetry.diskTotalBytes;
  if (typeof telemetry.diskUsedBytes === "number") updates.diskUsedBytes = telemetry.diskUsedBytes;
  if (typeof telemetry.uplinkSpeedBytes === "number") updates.uplinkSpeedBytes = telemetry.uplinkSpeedBytes;
  if (typeof telemetry.downlinkSpeedBytes === "number") updates.downlinkSpeedBytes = telemetry.downlinkSpeedBytes;
  if (telemetry.loadAvg) updates.loadAvg = telemetry.loadAvg;
  if (telemetry.uptime) updates.uptime = telemetry.uptime;
  if (telemetry.os) updates.os = telemetry.os;
  if (telemetry.arch) updates.arch = telemetry.arch;
  if (typeof telemetry.tcpCount === "number") updates.tcpCount = telemetry.tcpCount;
  if (typeof telemetry.udpCount === "number") updates.udpCount = telemetry.udpCount;

  db.updateNode(node.id, updates);
  wsHub.broadcastNodeUpdate(node.id);
  res.json({ success: true, message: "Telemetry updated" });
});

// -------------------------------------------------------------
// 6. Dual Deployment Installer Script (Proxy Node + Probe Agent)
// -------------------------------------------------------------
apiRouter.get("/install.sh", (req, res) => {
  const panelUrl = `${req.protocol}://${req.get("host")}`;
  const scriptPath = path.resolve(__dirname, "../../data/install.sh");
  if (fs.existsSync(scriptPath)) {
    const raw = fs.readFileSync(scriptPath, "utf-8");
    res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
    return res.send(raw.replaceAll("{{DEFAULT_PANEL_URL}}", panelUrl));
  }
  res.status(500).send("# Error: install.sh template missing");
});

