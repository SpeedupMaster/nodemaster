import type { RequestHandler } from "express";

export const validateRequest: RequestHandler = (req, res, next) => {
  const fail = (field: string) => res.status(400).json({ success: false, message: `参数无效: ${field}` });
  for (const [key, value] of Object.entries(req.query)) if (typeof value !== "string") { fail(key); return; }
  if (!["POST", "PUT", "PATCH"].includes(req.method)) { next(); return; }
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) { fail("JSON body"); return; }
  for (const key of ["username", "password", "oldPassword", "newPassword", "name", "ip", "sni", "serverName", "token", "country", "countryName", "description", "version", "target", "ssMethod", "ssPassword", "mainNodeId", "unlockNodeId", "transitNodeId", "exitNodeId", "customHost", "expiresAt"]) {
    if (body[key] !== undefined && body[key] !== null && (typeof body[key] !== "string" || body[key].length > 2048)) { fail(key); return; }
  }
  for (const key of ["port", "trafficLimitBytes", "trafficLimitGB", "bandwidthMbps", "trafficResetDay", "costAmount", "expireAt", "intervalSec", "priority"]) {
    if (body[key] === undefined || body[key] === null || body[key] === "") continue;
    if (key === "port" && req.path.startsWith("/routing/")) continue;
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) { fail(key); return; }
    if (key === "port" && (!Number.isInteger(value) || value < 1 || value > 65535)) { fail(key); return; }
    if (key === "trafficResetDay" && (!Number.isInteger(value) || value < 1 || value > 31)) { fail(key); return; }
    if (key === "intervalSec" && (value < 10 || value > 86400)) { fail(key); return; }
  }
  for (const key of ["tags", "nodeIds", "ids", "domains", "geosite", "ips", "geoip", "inboundNodeIds", "customServices", "customDomains"]) {
    if (body[key] !== undefined && (!Array.isArray(body[key]) || body[key].length > 1000 || body[key].some((v: unknown) => typeof v !== "string" || v.length > 2048))) { fail(key); return; }
  }
  for (const key of ["enabled", "autoRenew"]) if (body[key] !== undefined && typeof body[key] !== "boolean") { fail(key); return; }
  if (body.sni !== undefined && (typeof body.sni !== "string" || !/^[a-zA-Z0-9.-]+$/.test(body.sni))) { fail("sni"); return; }
  if (body.serverName !== undefined && !/^[a-zA-Z0-9.-]+$/.test(body.serverName)) { fail("serverName"); return; }
  if (body.ip !== undefined && !/^[a-zA-Z0-9.:[\]-]+$/.test(body.ip)) { fail("ip"); return; }
  if (req.path.startsWith("/nodes") && req.path !== "/nodes/telemetry" && body.protocol !== undefined && !["vless-reality", "shadowsocks"].includes(body.protocol)) { fail("protocol"); return; }
  if (body.status !== undefined) {
    const allowed = req.path.startsWith("/relays") ? ["active", "inactive"] : ["online", "offline", "circuit_broken"];
    if (!allowed.includes(body.status)) { fail("status"); return; }
  }
  if (body.mode !== undefined && !["ai_media", "all", "custom"].includes(body.mode)) { fail("mode"); return; }
  if (body.targetOutbound !== undefined && !["DIRECT", "BLOCK", "UNLOCK_OUT", "PROXY"].includes(body.targetOutbound)) { fail("targetOutbound"); return; }
  if (req.path.startsWith("/routing/") && body.protocol !== undefined && (!Array.isArray(body.protocol) || body.protocol.some((v: unknown) => typeof v !== "string"))) { fail("protocol"); return; }
  if (body.shadowsocks !== undefined && (!body.shadowsocks || typeof body.shadowsocks !== "object" || typeof body.shadowsocks.method !== "string" || typeof body.shadowsocks.password !== "string")) { fail("shadowsocks"); return; }
  const cipher = body.shadowsocks?.method || body.ssMethod;
  const password = body.shadowsocks?.password || body.ssPassword;
  if (cipher !== undefined) {
    if (!["2022-blake3-aes-128-gcm", "2022-blake3-aes-256-gcm", "2022-blake3-chacha20-poly1305", "aes-128-gcm", "aes-256-gcm", "chacha20-ietf-poly1305"].includes(cipher)) { fail("ssMethod"); return; }
    if (password && cipher.startsWith("2022-") && Buffer.from(password, "base64").length !== (cipher === "2022-blake3-aes-128-gcm" ? 16 : 32)) { fail("ssPassword"); return; }
  }
  next();
};
