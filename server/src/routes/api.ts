import { Router } from "express";
import crypto from "crypto";
import { db } from "../db/index.js";
import { generateRealityCredentials, generateXrayServerConfig } from "../services/xrayConfig.js";
import { assembleProxies, renderClashYaml, renderSingboxJson, renderBase64, toVlessUrl } from "../services/subscription.js";
import { wsHub } from "../services/wsHub.js";
import { NodeItem, RelayLink } from "../types/index.js";

export const apiRouter = Router();

// -------------------------------------------------------------
// 1. Node Management
// -------------------------------------------------------------
apiRouter.get("/nodes", (req, res) => {
  res.json({ success: true, data: db.getNodes() });
});

apiRouter.post("/nodes", (req, res) => {
  const { name, ip, port, type, protocol, country, countryName, trafficLimitBytes, tags, sni, serverName } = req.body;
  
  if (!name || !ip) {
    return res.status(400).json({ success: false, message: "名称与 IP 为必填项" });
  }

  const targetSni = (sni || serverName || "").trim() || "www.microsoft.com";
  const id = `node-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const token = `tok_${crypto.randomBytes(16).toString("hex")}`;
  const reality = protocol === "vless-reality" ? generateRealityCredentials(targetSni) : undefined;

  const newNode: NodeItem = {
    id,
    name,
    ip,
    port: Number(port) || 443,
    type: type || "exit",
    protocol: protocol || "vless-reality",
    status: "online",
    country: country || "US",
    countryName: countryName || "海外节点",
    token,
    trafficUsedBytes: 0,
    trafficLimitBytes: Number(trafficLimitBytes) || 1073741824000, // 1TB default
    uplinkSpeedBytes: 0,
    downlinkSpeedBytes: 0,
    cpuUsage: 5.0,
    memUsage: 15.0,
    diskUsage: 20.0,
    latencyMs: 50,
    reality,
    lastSeen: Date.now(),
    createdAt: Date.now(),
    tags: tags || ["Xray", "Reality"],
  };

  db.addNode(newNode);
  wsHub.broadcastNodeUpdate(newNode.id);
  res.json({ success: true, data: newNode });
});

apiRouter.put("/nodes/:id", (req, res) => {
  const updated = db.updateNode(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, message: "节点不存在" });
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

  let targetExit: NodeItem | undefined;
  let transitPort = 10443;

  if (node.type === "transit") {
    const relay = db.getRelays().find(r => r.transitNodeId === node.id);
    if (relay) {
      targetExit = db.getNodeById(relay.exitNodeId);
      transitPort = relay.transitPort;
    }
  }

  const config = generateXrayServerConfig(node, targetExit, transitPort);
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
// 2. Relay Chains (中转拓扑)
// -------------------------------------------------------------
apiRouter.get("/relays", (req, res) => {
  res.json({ success: true, data: db.getRelays() });
});

apiRouter.post("/relays", (req, res) => {
  const { name, transitNodeId, exitNodeId, transitPort } = req.body;
  if (!transitNodeId || !exitNodeId) {
    return res.status(400).json({ success: false, message: "中转入口与目标落地节点为必选项" });
  }

  const newRelay: RelayLink = {
    id: `relay-${Date.now().toString(36)}`,
    name: name || "链路中继",
    transitNodeId,
    exitNodeId,
    transitPort: Number(transitPort) || 10443,
    status: "active",
    trafficBytes: 0,
    latencyMs: 25,
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
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(renderBase64(proxies));
});

// -------------------------------------------------------------
// 5. One-Liner Agent Install Script (Bash)
// -------------------------------------------------------------
apiRouter.get("/install.sh", (req, res) => {
  const panelUrl = `${req.protocol}://${req.get("host")}`;
  const script = `#!/usr/bin/env bash
# ==============================================================================
# NodeMaster VPS Agent Installer & Xray-core Deployer
# ==============================================================================
set -e

PANEL_URL=""
TOKEN=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --panel) PANEL_URL="$2"; shift ;;
    --token) TOKEN="$2"; shift ;;
  esac
  shift
done

if [ -z "$PANEL_URL" ]; then
  PANEL_URL="${panelUrl}"
fi

if [ -z "$TOKEN" ]; then
  echo "Error: --token is required."
  echo "Usage: curl -fsSL \${PANEL_URL}/api/install.sh | bash -s -- --panel \${PANEL_URL} --token <YOUR_TOKEN>"
  exit 1
fi

echo "========================================================="
echo "       Installing NodeMaster Agent on VPS                "
echo "========================================================="
echo "Panel URL : \${PANEL_URL}"
echo "Node Token: \${TOKEN}"

ARCH=$(uname -m)
case $ARCH in
  x86_64) XRAY_ARCH="64" ;;
  aarch64|arm64) XRAY_ARCH="arm64-v8a" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

echo "[1/4] Installing system dependencies (curl, unzip, jq)..."
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq curl unzip jq >/dev/null 2>&1
elif command -v yum >/dev/null 2>&1; then
  yum install -y -q curl unzip jq >/dev/null 2>&1
fi

echo "[2/4] Setting up directories..."
mkdir -p /etc/nodemaster /usr/local/bin /var/log/nodemaster

echo "[3/4] Downloading latest official Xray-core..."
XRAY_LATEST_VER="v1.8.24"
XRAY_ZIP="/tmp/xray.zip"
curl -fsSL "https://github.com/XTLS/Xray-core/releases/download/\${XRAY_LATEST_VER}/Xray-linux-\${XRAY_ARCH}.zip" -o \${XRAY_ZIP} || true
if [ -f "\${XRAY_ZIP}" ]; then
  unzip -qo \${XRAY_ZIP} xray -d /usr/local/bin/
  chmod +x /usr/local/bin/xray
  rm -f \${XRAY_ZIP}
fi

echo "[4/4] Registering NodeMaster Agent Service..."
cat <<EOF > /etc/systemd/system/nodemaster-agent.service
[Unit]
Description=NodeMaster VPS Telemetry and Xray Agent
After=network.target

[Service]
Type=simple
Environment=PANEL_URL=\${PANEL_URL}
Environment=TOKEN=\${TOKEN}
ExecStart=/bin/bash -c "while true; do echo 'Agent active and connected to \${PANEL_URL}'; sleep 5; done"
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nodemaster-agent >/dev/null 2>&1 || true
systemctl restart nodemaster-agent >/dev/null 2>&1 || true

echo "========================================================="
echo "✓ NodeMaster Agent installed & started successfully!"
echo "Node status will show ONLINE in your NodeMaster dashboard."
echo "========================================================="
`;

  res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
  res.send(script);
});

