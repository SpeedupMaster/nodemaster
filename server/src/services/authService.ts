import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function hashPassword(password: string, customSalt?: string): { hash: string; salt: string } {
  const salt = customSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signToken(payload: Record<string, any>, expiresInSec: number = 7 * 86400): string {
  const secret = db.getConfig().jwtSecret || "nm_secret_key_8848_secure";
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSec };

  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encHeader}.${encPayload}`)
    .digest("base64url");

  return `${encHeader}.${encPayload}.${signature}`;
}

export function verifyToken(token: string): { valid: boolean; payload?: any; error?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Missing token" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid token format" };
  }

  const [encHeader, encPayload, signature] = parts;
  const secret = db.getConfig().jwtSecret || "nm_secret_key_8848_secure";
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${encHeader}.${encPayload}`)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, error: "Invalid signature" };
  }

  try {
    const payloadJson = Buffer.from(encPayload, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Token expired" };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: "Malformed payload" };
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  if (typeof req.query.token === "string" && req.query.token.length > 0) {
    return req.query.token;
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "未登录或缺少凭证，请登录管理员账号",
    });
    return;
  }

  const verification = verifyToken(token);
  if (!verification.valid) {
    res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "登录凭证已过期或无效，请重新登录",
    });
    return;
  }

  (req as any).user = verification.payload;
  next();
}
