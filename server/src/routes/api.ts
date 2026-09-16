import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { generateRealityCredentials, generateShadowsocksCredentials, generateXrayServerConfig, compileRuleForPreview } from "../services/xrayConfig.js";
import { assembleProxies, renderClashYaml, renderSingboxJson, renderBase64, toVlessUrl } from "../services/subscription.js";
import { wsHub } from "../services/wsHub.js";
import { NodeItem, RelayLink, ShadowsocksConfig, XrayRealityConfig, LatencyTask, RoutingRule } from "../types/index.js";

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

  const existingRelays = db.getRelays();
  const duplicate = existingRelays.find(
    (r) =>
      (r.mainNodeId === mainId || r.transitNodeId === mainId) &&
      (r.unlockNodeId === unlockId || r.exitNodeId === unlockId)
  );
  if (duplicate) {
    return res.status(400).json({
      success: false,
      message: `该主力机与解锁机之间已存在链路「${duplicate.name}」，无需重复创建`,
    });
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

// -------------------------------------------------------------
// 7. Latency Monitoring Tasks & History API
// -------------------------------------------------------------
apiRouter.get("/ping/tasks", (req, res) => {
  res.json({ success: true, data: db.getLatencyTasks() });
});

apiRouter.post("/ping/tasks", (req, res) => {
  const { name, target, type, intervalSec, nodeIds, enabled } = req.body;
  if (!name || !target) {
    return res.status(400).json({ success: false, message: "任务名称与目标地址为必填项" });
  }

  const tasks = db.getLatencyTasks();
  const newTask: LatencyTask = {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    target: target.trim(),
    type: type === "icmp" ? "icmp" : "tcp",
    intervalSec: Number(intervalSec) || 60,
    nodeIds: Array.isArray(nodeIds) ? nodeIds : [],
    enabled: enabled !== false,
    order: tasks.length + 1,
  };

  db.addLatencyTask(newTask);
  res.json({ success: true, data: newTask });
});

apiRouter.put("/ping/tasks/:id", (req, res) => {
  const existing = db.getLatencyTaskById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "任务不存在" });
  }

  const { name, target, type, intervalSec, nodeIds, enabled, order } = req.body;
  const updates: Partial<LatencyTask> = {};
  if (name !== undefined) updates.name = name.trim();
  if (target !== undefined) updates.target = target.trim();
  if (type !== undefined) updates.type = type === "icmp" ? "icmp" : "tcp";
  if (intervalSec !== undefined) updates.intervalSec = Number(intervalSec) || 60;
  if (nodeIds !== undefined) updates.nodeIds = Array.isArray(nodeIds) ? nodeIds : [];
  if (enabled !== undefined) updates.enabled = Boolean(enabled);
  if (order !== undefined) updates.order = Number(order);

  const updated = db.updateLatencyTask(req.params.id, updates);
  res.json({ success: true, data: updated });
});

apiRouter.delete("/ping/tasks/:id", (req, res) => {
  const ok = db.deleteLatencyTask(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: "任务不存在" });
  res.json({ success: true, message: "任务已删除" });
});

apiRouter.post("/ping/tasks/presets", (req, res) => {
  const resetTasks = db.resetLatencyTasks();
  res.json({ success: true, data: resetTasks });
});

apiRouter.get("/ping/node-history/:nodeId", (req, res) => {
  const range = (req.query.range as string) || "1h";
  const history = db.getNodeLatencyHistory(req.params.nodeId, range);
  res.json({ success: true, data: history });
});

apiRouter.get("/nodes/:id/history", (req, res) => {
  const range = (req.query.range as string) || "1h";
  const history = db.getNodeLoadHistory(req.params.id, range);
  if (!history) return res.status(404).json({ success: false, message: "节点不存在" });
  res.json({ success: true, data: history });
});

// -------------------------------------------------------------
// 8. Visual Routing Rules Management & Simulation API
// -------------------------------------------------------------
apiRouter.get("/routing/rules", (req, res) => {
  res.json({ success: true, data: db.getRoutingRules() });
});

apiRouter.post("/routing/rules", (req, res) => {
  const {
    name,
    description,
    enabled,
    priority,
    targetOutbound,
    targetNodeId,
    domains,
    geosite,
    ips,
    geoip,
    protocol,
    port,
    inboundNodeIds,
    builtInPresetId,
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "规则名称为必填项" });
  }

  const existing = db.getRoutingRules();
  const maxPriority = existing.reduce((max, r) => Math.max(max, r.priority || 0), 0);

  const newRule: RoutingRule = {
    id: `rule-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    description: (description || "").trim(),
    enabled: enabled !== false,
    priority: Number(priority) || maxPriority + 1,
    targetOutbound: targetOutbound || "DIRECT",
    targetNodeId: targetNodeId || undefined,
    domains: Array.isArray(domains) ? domains.filter(Boolean).map((d: string) => d.trim()) : [],
    geosite: Array.isArray(geosite) ? geosite.filter(Boolean).map((g: string) => g.trim()) : [],
    ips: Array.isArray(ips) ? ips.filter(Boolean).map((ip: string) => ip.trim()) : [],
    geoip: Array.isArray(geoip) ? geoip.filter(Boolean).map((g: string) => g.trim()) : [],
    protocol: Array.isArray(protocol) ? protocol.filter(Boolean).map((p: string) => p.trim()) : [],
    port: (port || "").trim(),
    inboundNodeIds: Array.isArray(inboundNodeIds) ? inboundNodeIds : [],
    builtInPresetId: builtInPresetId || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const created = db.addRoutingRule(newRule);
  wsHub.broadcastToWeb({ type: "ROUTING_RULES_UPDATE", rules: db.getRoutingRules() });
  res.json({ success: true, data: created });
});

apiRouter.put("/routing/rules/:id", (req, res) => {
  const existing = db.getRoutingRuleById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "分流规则不存在" });
  }

  const updates: Partial<RoutingRule> = {};
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
  if (req.body.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);
  if (req.body.priority !== undefined) updates.priority = Number(req.body.priority);
  if (req.body.targetOutbound !== undefined) updates.targetOutbound = req.body.targetOutbound;
  if (req.body.targetNodeId !== undefined) updates.targetNodeId = req.body.targetNodeId;
  if (req.body.domains !== undefined) updates.domains = Array.isArray(req.body.domains) ? req.body.domains.filter(Boolean) : [];
  if (req.body.geosite !== undefined) updates.geosite = Array.isArray(req.body.geosite) ? req.body.geosite.filter(Boolean) : [];
  if (req.body.ips !== undefined) updates.ips = Array.isArray(req.body.ips) ? req.body.ips.filter(Boolean) : [];
  if (req.body.geoip !== undefined) updates.geoip = Array.isArray(req.body.geoip) ? req.body.geoip.filter(Boolean) : [];
  if (req.body.protocol !== undefined) updates.protocol = Array.isArray(req.body.protocol) ? req.body.protocol.filter(Boolean) : [];
  if (req.body.port !== undefined) updates.port = String(req.body.port).trim();
  if (req.body.inboundNodeIds !== undefined) updates.inboundNodeIds = Array.isArray(req.body.inboundNodeIds) ? req.body.inboundNodeIds : [];

  const updated = db.updateRoutingRule(req.params.id, updates);
  wsHub.broadcastToWeb({ type: "ROUTING_RULES_UPDATE", rules: db.getRoutingRules() });
  res.json({ success: true, data: updated });
});

apiRouter.delete("/routing/rules/:id", (req, res) => {
  const ok = db.deleteRoutingRule(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: "分流规则不存在" });
  wsHub.broadcastToWeb({ type: "ROUTING_RULES_UPDATE", rules: db.getRoutingRules() });
  res.json({ success: true, message: "分流规则已删除" });
});

apiRouter.post("/routing/rules/reorder", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ success: false, message: "参数错误: ids 必须为数组" });
  }

  const reordered = db.reorderRoutingRules(ids);
  wsHub.broadcastToWeb({ type: "ROUTING_RULES_UPDATE", rules: reordered });
  res.json({ success: true, data: reordered });
});

apiRouter.post("/routing/rules/presets", (req, res) => {
  const resetRules = db.resetRoutingRules();
  wsHub.broadcastToWeb({ type: "ROUTING_RULES_UPDATE", rules: resetRules });
  res.json({ success: true, data: resetRules });
});

apiRouter.post("/routing/rules/preview", (req, res) => {
  const preview = compileRuleForPreview(req.body);
  res.json({ success: true, data: preview });
});

apiRouter.post("/routing/rules/simulate", (req, res) => {
  const { target, protocol } = req.body;
  if (!target || !target.trim()) {
    return res.status(400).json({ success: false, message: "请输入待测试的域名或 IP 地址" });
  }

  const rules = db.getRoutingRules().filter((r) => r.enabled);
  const testTarget = target.trim().toLowerCase();
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(testTarget) || testTarget.includes(":");

  let matchedRule: RoutingRule | null = null;
  let matchReason = "";

  for (const r of rules) {
    // 1. Protocol match
    if (protocol && r.protocol && r.protocol.includes(protocol)) {
      matchedRule = r;
      matchReason = `匹配协议: ${protocol}`;
      break;
    }

    // 2. IP / GeoIP match
    if (isIp) {
      if (
        r.ips &&
        r.ips.some(
          (ip) =>
            ip === testTarget ||
            testTarget.startsWith(ip.replace(/\/\d+$/, "")) ||
            ip.includes(testTarget)
        )
      ) {
        matchedRule = r;
        matchReason = `命中自定义 IP / CIDR 网段规则`;
        break;
      }

      if (r.geoip) {
        if (
          r.geoip.includes("cn") &&
          (testTarget.startsWith("223.") ||
            testTarget.startsWith("114.") ||
            testTarget.startsWith("119.") ||
            testTarget.startsWith("180."))
        ) {
          matchedRule = r;
          matchReason = `命中 GeoIP: CN (中国大陆 IP 网段)`;
          break;
        }

        if (
          r.geoip.includes("private") &&
          (testTarget.startsWith("192.168.") ||
            testTarget.startsWith("10.") ||
            testTarget.startsWith("127.") ||
            testTarget.startsWith("172.16."))
        ) {
          matchedRule = r;
          matchReason = `命中 GeoIP: Private (内网私有地址)`;
          break;
        }

        if (
          r.geoip.includes("telegram") &&
          (testTarget.startsWith("149.154.") || testTarget.startsWith("91.108."))
        ) {
          matchedRule = r;
          matchReason = `命中 GeoIP: Telegram 专属网段`;
          break;
        }
      }
    } else {
      // 3. Domain match
      if (
        r.domains &&
        r.domains.some((d) => {
          const clean = d.replace(/^domain:/, "").replace(/^\*\./, "").toLowerCase();
          return testTarget === clean || testTarget.endsWith("." + clean);
        })
      ) {
        matchedRule = r;
        matchReason = `命中自定义域名规则 (*.${testTarget})`;
        break;
      }

      // 4. Geosite match
      if (r.geosite) {
        for (const g of r.geosite) {
          const clean = g.replace(/^geosite:/, "").toLowerCase();
          if (
            (clean === "openai" || clean === "category-ai-chat-!cn") &&
            (testTarget.includes("openai") ||
              testTarget.includes("chatgpt") ||
              testTarget.includes("oaistatic") ||
              testTarget.includes("oaiusercontent"))
          ) {
            matchedRule = r;
            matchReason = `命中 Geosite: openai (ChatGPT/OpenAI)`;
            break;
          }
          if (
            clean === "anthropic" &&
            (testTarget.includes("anthropic") || testTarget.includes("claude"))
          ) {
            matchedRule = r;
            matchReason = `命中 Geosite: anthropic (Claude)`;
            break;
          }
          if (clean === "netflix" && testTarget.includes("netflix")) {
            matchedRule = r;
            matchReason = `命中 Geosite: netflix (奈飞流媒体)`;
            break;
          }
          if (
            clean === "youtube" &&
            (testTarget.includes("youtube") ||
              testTarget.includes("googlevideo") ||
              testTarget.includes("ytimg"))
          ) {
            matchedRule = r;
            matchReason = `命中 Geosite: youtube (油管视频)`;
            break;
          }
          if (
            clean === "disney" &&
            (testTarget.includes("disney") || testTarget.includes("bamgrid"))
          ) {
            matchedRule = r;
            matchReason = `命中 Geosite: disney (迪士尼+)`;
            break;
          }
          if (
            clean === "telegram" &&
            (testTarget.includes("telegram") || testTarget.includes("t.me"))
          ) {
            matchedRule = r;
            matchReason = `命中 Geosite: telegram (电报通讯)`;
            break;
          }
          if (
            clean === "cn" &&
            (testTarget.endsWith(".cn") ||
              testTarget.includes("baidu") ||
              testTarget.includes("qq.com") ||
              testTarget.includes("alipay") ||
              testTarget.includes("taobao") ||
              testTarget.includes("bilibili") ||
              testTarget.includes("jd.com"))
          ) {
            matchedRule = r;
            matchReason = `命中 Geosite: cn (中国大陆主流站点)`;
            break;
          }
          if (clean === "google" && testTarget.includes("google")) {
            matchedRule = r;
            matchReason = `命中 Geosite: google`;
            break;
          }
          if (clean === "github" && testTarget.includes("github")) {
            matchedRule = r;
            matchReason = `命中 Geosite: github`;
            break;
          }
          if (clean === "steam" && testTarget.includes("steam")) {
            matchedRule = r;
            matchReason = `命中 Geosite: steam (游戏分发平台)`;
            break;
          }
        }
        if (matchedRule) break;
      }
    }

    // 5. Fallback rule
    if (
      r.builtInPresetId === "preset_fallback" ||
      r.name.includes("兜底") ||
      r.name.includes("Fallback")
    ) {
      matchedRule = r;
      matchReason = `未命中前置特征规则，匹配漏网之鱼兜底分流`;
      break;
    }
  }

  if (!matchedRule) {
    return res.json({
      success: true,
      data: {
        matched: false,
        target,
        ruleId: null,
        ruleName: "未命中任何规则",
        priority: 999,
        action: "DIRECT",
        reason: "未配置对应规则或已禁用，默认直连出站",
      },
    });
  }

  res.json({
    success: true,
    data: {
      matched: true,
      target,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
      priority: matchedRule.priority,
      action: matchedRule.targetOutbound,
      reason: matchReason,
    },
  });
});


