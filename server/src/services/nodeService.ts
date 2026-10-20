import crypto from "crypto";
import { db, bumpConfigVersion } from "../db/index.js";
import { billingPeriod, newId } from "./security.js";
import { generateRealityCredentials, generateShadowsocksCredentials } from "./xrayConfig.js";
import { InputError, HOSTNAME, HOST_OR_IP, PORT, nullableNumber, nullableString, optBoolean, optEnum, optNumber, optString, optStringArray, required } from "./validation.js";
import { DEFAULT_BANDWIDTH_MBPS, DEFAULT_REALITY_PORT, DEFAULT_SNI, DEFAULT_SS_PORT, DEFAULT_TAGS, DEFAULT_TRAFFIC_LIMIT, SS_CIPHERS } from "../constants.js";
import type { NodeInput, NodeItem } from "../types/index.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates the editable node fields of a request body; absent fields stay undefined. */
export function parseNodeInput(body: any): NodeInput {
  const ss = body.shadowsocks;
  if (ss !== undefined && (typeof ss !== "object" || ss === null || Array.isArray(ss))) throw new InputError("参数无效: shadowsocks");
  return {
    name: optString(body, "name"),
    ip: optString(body, "ip", HOST_OR_IP),
    port: optNumber(body, "port", PORT),
    protocol: optEnum(body, "protocol", ["vless-reality", "shadowsocks"] as const),
    country: optString(body, "country"),
    countryName: optString(body, "countryName"),
    trafficLimitBytes: optNumber(body, "trafficLimitBytes", { integer: true }),
    bandwidthMbps: optNumber(body, "bandwidthMbps", { min: 1 }),
    trafficResetDay: optNumber(body, "trafficResetDay", { min: 1, max: 31, integer: true }),
    costAmount: nullableNumber(body, "costAmount"),
    costCurrency: optEnum(body, "costCurrency", ["CNY", "USD", "EUR"] as const),
    costPeriod: optEnum(body, "costPeriod", ["monthly", "quarterly", "annually"] as const),
    expiresAt: nullableString(body, "expiresAt", DATE),
    autoRenew: optBoolean(body, "autoRenew"),
    tags: optStringArray(body, "tags"),
    sni: optString(body, "sni", HOSTNAME),
    shadowsocks: ss && {
      method: optEnum(ss, "method", SS_CIPHERS),
      password: optString(ss, "password"),
    },
  };
}

/** Fields that map 1:1 from the input onto the stored node. `null` clears the value. */
function plainFields(input: NodeInput): Partial<NodeItem> {
  const fields: Partial<NodeItem> = {};
  const keys = ["name", "ip", "port", "country", "countryName", "trafficLimitBytes", "bandwidthMbps", "trafficResetDay",
    "costAmount", "costCurrency", "costPeriod", "expiresAt", "autoRenew", "tags"] as const;
  for (const key of keys) {
    const value = input[key];
    if (value !== undefined) (fields as any)[key] = value ?? undefined;
  }
  return fields;
}

export function createNode(input: NodeInput): NodeItem {
  const name = required(input.name, "名称与 IP 为必填项");
  const ip = required(input.ip, "名称与 IP 为必填项");
  const kind = input.protocol === "shadowsocks" ? "unlock" : "direct";
  const now = Date.now();
  const node: NodeItem = {
    id: newId("node"),
    name,
    ip,
    port: kind === "unlock" ? DEFAULT_SS_PORT : DEFAULT_REALITY_PORT,
    type: kind,
    protocol: kind === "unlock" ? "shadowsocks" : "vless-reality",
    status: "offline",
    country: "US",
    countryName: kind === "unlock" ? "美国原生住宅" : "海外主力节点",
    token: `tok_${crypto.randomBytes(16).toString("hex")}`,
    trafficUsedBytes: 0,
    trafficLimitBytes: DEFAULT_TRAFFIC_LIMIT[kind],
    uplinkSpeedBytes: 0,
    downlinkSpeedBytes: 0,
    cpuUsage: 0,
    memUsage: 0,
    diskUsage: 0,
    latencyMs: 0,
    bandwidthMbps: DEFAULT_BANDWIDTH_MBPS,
    trafficResetDay: 1,
    costCurrency: "CNY",
    costPeriod: "monthly",
    autoRenew: false,
    lastSeen: 0,
    createdAt: now,
    ...plainFields(input),
    tags: input.tags?.length ? input.tags : [...DEFAULT_TAGS[kind]],
    ...(kind === "unlock"
      ? { shadowsocks: generateShadowsocksCredentials(input.shadowsocks?.method, input.shadowsocks?.password || undefined) }
      : { reality: generateRealityCredentials(input.sni || DEFAULT_SNI) }),
    ...bumpConfigVersion({}, now),
  };
  node.trafficPeriodStart = billingPeriod(now, node.trafficResetDay || 1);
  return db.addNode(node);
}

/**
 * Applies an edit. Changes that alter the node's own Xray config bump its config version; changes to
 * an unlock node's address or credentials also bump the main nodes that chain through it.
 */
export function updateNode(existing: NodeItem, input: NodeInput): NodeItem {
  const updates = plainFields(input);
  let configChanged = updates.port !== undefined && updates.port !== existing.port;

  if (existing.reality && input.sni && input.sni !== existing.reality.serverName) {
    updates.reality = { ...existing.reality, serverName: input.sni, dest: `${input.sni}:443` };
    configChanged = true;
  }
  if (existing.shadowsocks && input.shadowsocks) {
    const method = input.shadowsocks.method || existing.shadowsocks.method;
    // A new cipher may need a different key length, so it only keeps the password when it was sent
    const password = input.shadowsocks.password || (method === existing.shadowsocks.method ? existing.shadowsocks.password : undefined);
    if (method !== existing.shadowsocks.method || password !== existing.shadowsocks.password) {
      updates.shadowsocks = generateShadowsocksCredentials(method, password);
      configChanged = true;
    }
  }
  if (updates.trafficResetDay !== undefined && updates.trafficResetDay !== existing.trafficResetDay) {
    updates.trafficPeriodStart = billingPeriod(Date.now(), updates.trafficResetDay);
  }
  if (configChanged) Object.assign(updates, bumpConfigVersion(existing));

  const updated = db.updateNode(existing.id, updates)!;
  if (configChanged || (updates.ip !== undefined && updates.ip !== existing.ip)) {
    const dependents = db.getRelays().filter((r) => r.unlockNodeId === existing.id).map((r) => r.mainNodeId);
    if (dependents.length) db.invalidateConfigs(dependents);
  }
  return updated;
}
