import { Router } from "express";
import { db, bumpConfigVersion } from "../db/index.js";
import { billingPeriod } from "../services/security.js";
import { createNode, parseNodeInput, updateNode } from "../services/nodeService.js";
import { getNodeXrayConfig } from "../services/xrayConfig.js";
import { historyStore } from "../services/historyStore.js";
import { notFound } from "../services/validation.js";
import { wsHub } from "../services/wsHub.js";
import { OFFLINE_AFTER_MS } from "../constants.js";
import { ok } from "./util.js";

export const nodesRouter = Router();

const nodeOr404 = (id: string) => db.getNodeById(id) ?? notFound("节点");
const range = (value: unknown) => (typeof value === "string" && value) || "1h";

nodesRouter.get("/nodes", (_req, res) => ok(res, db.getNodes()));

nodesRouter.post("/nodes", (req, res) => {
  const node = createNode(parseNodeInput(req.body));
  wsHub.broadcastNodeUpdate(node.id);
  ok(res, node);
});

nodesRouter.put("/nodes/:id", (req, res) => {
  const updated = updateNode(nodeOr404(req.params.id), parseNodeInput(req.body));
  wsHub.broadcastNodeUpdate(updated.id);
  ok(res, updated);
});

nodesRouter.delete("/nodes/:id", (req, res) => {
  if (!db.deleteNode(req.params.id)) notFound("节点");
  wsHub.broadcastToWeb({ type: "NODE_DELETED", id: req.params.id });
  wsHub.broadcastRelays();
  ok(res, undefined, "节点已删除");
});

nodesRouter.get("/nodes/:id/xray-config", (req, res) => ok(res, getNodeXrayConfig(nodeOr404(req.params.id))));

nodesRouter.post("/nodes/:id/sync", (req, res) => {
  const updated = db.updateNode(req.params.id, bumpConfigVersion(nodeOr404(req.params.id)))!;
  wsHub.broadcastNodeUpdate(updated.id);
  ok(res, { nodeId: updated.id, configVersion: updated.configVersion, status: "pending" }, "已触发配置热同步，探针将在下次上报（约 3 秒）时拉取新配置并重载");
});

nodesRouter.post("/nodes/:id/reset-traffic", (req, res) => {
  const node = nodeOr404(req.params.id);
  const now = Date.now();
  const updated = db.updateNode(node.id, {
    trafficUsedBytes: 0,
    trafficPeriodStart: billingPeriod(now, node.trafficResetDay || 1),
    // Lifts a traffic circuit breaker
    status: now - node.lastSeen < OFFLINE_AFTER_MS ? "online" : "offline",
    ...bumpConfigVersion(node, now),
  })!;
  wsHub.broadcastNodeUpdate(updated.id);
  ok(res, updated, "流量已重置");
});

nodesRouter.get("/nodes/:id/history", (req, res) => {
  nodeOr404(req.params.id);
  ok(res, historyStore.loadHistory(req.params.id, range(req.query.range)));
});

nodesRouter.get("/ping/node-history/:nodeId", (req, res) => {
  ok(res, historyStore.latencyHistory(req.params.nodeId, range(req.query.range), db.getLatencyTasksFor(req.params.nodeId)));
});
