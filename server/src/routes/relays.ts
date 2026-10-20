import { Router } from "express";
import crypto from "crypto";
import { db } from "../db/index.js";
import { newId } from "../services/security.js";
import { InputError, notFound, optEnum, optString, optStringArray } from "../services/validation.js";
import { UNLOCK_SERVICES } from "../services/xrayConfig.js";
import { wsHub } from "../services/wsHub.js";
import type { RelayLink } from "../types/index.js";
import { ok } from "./util.js";

export const relaysRouter = Router();

const SERVICE_IDS = UNLOCK_SERVICES.map((s) => s.id);

function parseRelayInput(body: any) {
  const customServices = optStringArray(body, "customServices");
  if (customServices?.some((id) => !SERVICE_IDS.includes(id))) throw new InputError("参数无效: customServices");
  return {
    name: optString(body, "name"),
    mainNodeId: optString(body, "mainNodeId"),
    unlockNodeId: optString(body, "unlockNodeId"),
    mode: optEnum(body, "mode", ["ai_media", "all", "custom"] as const),
    customServices,
    customDomains: optStringArray(body, "customDomains"),
    status: optEnum(body, "status", ["active", "inactive"] as const),
  };
}

/** A relay chains a VLESS-Reality main node into another node; one active relay per main node. */
function checkRelay(relay: Pick<RelayLink, "id" | "mainNodeId" | "unlockNodeId" | "status">) {
  const main = db.getNodeById(relay.mainNodeId);
  if (!main?.reality || relay.mainNodeId === relay.unlockNodeId || !db.getNodeById(relay.unlockNodeId)) {
    throw new InputError("链路端点无效：主力节点须为 Reality 节点，且不能与解锁节点相同");
  }
  const others = db.getRelays().filter((r) => r.id !== relay.id);
  if (relay.status === "active" && others.some((r) => r.status === "active" && r.mainNodeId === relay.mainNodeId)) {
    throw new InputError("每个主力节点只能有一条活动链路");
  }
  const duplicate = others.find((r) => r.mainNodeId === relay.mainNodeId && r.unlockNodeId === relay.unlockNodeId);
  if (duplicate) throw new InputError(`该主力机与解锁机之间已存在链路「${duplicate.name}」，无需重复创建`);
}

relaysRouter.get("/relays", (_req, res) => ok(res, db.getRelays()));

relaysRouter.post("/relays", (req, res) => {
  const input = parseRelayInput(req.body);
  if (!input.mainNodeId || !input.unlockNodeId) throw new InputError("主力连接节点与目标解锁机为必选项");
  const relay: RelayLink = {
    id: newId("relay"),
    name: input.name || "链式解锁代理",
    mainNodeId: input.mainNodeId,
    unlockNodeId: input.unlockNodeId,
    mode: input.mode || "ai_media",
    customServices: input.customServices || [],
    customDomains: input.customDomains || [],
    chainUuid: crypto.randomUUID(),
    status: input.status || "active",
    createdAt: Date.now(),
  };
  checkRelay(relay);
  db.addRelay(relay);
  wsHub.broadcastRelays();
  ok(res, relay);
});

relaysRouter.put("/relays/:id", (req, res) => {
  const existing = db.getRelayById(req.params.id) ?? notFound("中转链路");
  const input = parseRelayInput(req.body);
  const updates = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<RelayLink>;
  checkRelay({ ...existing, ...updates });
  const updated = db.updateRelay(existing.id, updates);
  wsHub.broadcastRelays();
  ok(res, updated);
});

relaysRouter.delete("/relays/:id", (req, res) => {
  if (!db.deleteRelay(req.params.id)) notFound("中转链路");
  wsHub.broadcastRelays();
  ok(res, undefined, "中转链路已删除");
});
