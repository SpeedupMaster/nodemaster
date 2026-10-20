import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";

const SESSION_TTL_SEC = 7 * 86400;
const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

const sign = (data: string, secret: string) => crypto.createHmac("sha256", secret).update(data).digest("base64url");

export function signToken(payload: Record<string, unknown>, expiresInSec = SESSION_TTL_SEC): string {
  const secret = db.getConfig().jwtSecret;
  if (!secret) throw new Error("Signing key is not initialized");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, sessionVersion: db.getAdmin().sessionVersion, iat: now, exp: now + expiresInSec })).toString("base64url");
  return `${HEADER}.${body}.${sign(`${HEADER}.${body}`, secret)}`;
}

export function verifyToken(token: string): { valid: boolean; payload?: any; error?: string } {
  if (!token || typeof token !== "string") return { valid: false, error: "Missing token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, error: "Invalid token format" };

  const [encHeader, encPayload, signature] = parts;
  const secret = db.getConfig().jwtSecret;
  if (!secret) return { valid: false, error: "Signing key unavailable" };
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(`${encHeader}.${encPayload}`, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, error: "Invalid signature" };

  try {
    const payload = JSON.parse(Buffer.from(encPayload, "base64url").toString("utf-8"));
    const header = JSON.parse(Buffer.from(encHeader, "base64url").toString("utf-8"));
    const admin = db.getAdmin();
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "HS256" || header.typ !== "JWT" ||
        !Number.isFinite(payload.exp) || payload.exp <= now ||
        !Number.isFinite(payload.iat) || payload.iat > now + 30 ||
        payload.sub !== admin.username || payload.role !== "admin" ||
        payload.sessionVersion !== admin.sessionVersion) {
      return { valid: false, error: "Session expired or revoked" };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Malformed payload" };
  }
}

export const signAdminToken = () => signToken({ sub: db.getAdmin().username, role: "admin" });

/**
 * REST calls authenticate with the Authorization header only, so session tokens never end up in
 * URLs and access logs. (The WebSocket upgrade, which cannot set headers, reads it from its query.)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "未登录或缺少凭证，请登录管理员账号" });
    return;
  }
  if (!verifyToken(token).valid) {
    res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "登录凭证已过期或无效，请重新登录" });
    return;
  }
  next();
}
