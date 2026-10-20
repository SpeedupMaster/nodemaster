import type { RequestHandler } from "express";

/** An error whose message is safe to show the client; the error handler responds with its status. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Rejected client input (400). */
export class InputError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export const notFound = (what: string): never => { throw new HttpError(404, `${what}不存在`); };

const invalid = (field: string): never => { throw new InputError(`参数无效: ${field}`); };
const absent = (v: unknown) => v === undefined;
/** For nullable fields: null or "" means "clear the value". */
const cleared = (v: unknown) => v === null || v === "";

const MAX_STRING = 2048;
const MAX_ITEMS = 1000;

export function optString(body: any, field: string, pattern?: RegExp): string | undefined {
  const v = body[field];
  if (absent(v)) return undefined;
  if (typeof v !== "string" || v.length > MAX_STRING || (pattern && !pattern.test(v))) return invalid(field);
  return v.trim();
}

export function optNumber(body: any, field: string, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}): number | undefined {
  const v = body[field];
  if (absent(v)) return undefined;
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return invalid(field);
  return n;
}

/** `undefined` = not sent, `null` = clear, otherwise a valid number. */
export function nullableNumber(body: any, field: string): number | null | undefined {
  return cleared(body[field]) ? null : optNumber(body, field);
}

export function nullableString(body: any, field: string, pattern?: RegExp): string | null | undefined {
  return cleared(body[field]) ? null : optString(body, field, pattern);
}

export function optBoolean(body: any, field: string): boolean | undefined {
  const v = body[field];
  if (absent(v)) return undefined;
  return typeof v === "boolean" ? v : invalid(field);
}

export function optStringArray(body: any, field: string): string[] | undefined {
  const v = body[field];
  if (absent(v)) return undefined;
  if (!Array.isArray(v) || v.length > MAX_ITEMS || v.some((s) => typeof s !== "string" || s.length > MAX_STRING)) return invalid(field);
  return v.map((s: string) => s.trim()).filter(Boolean);
}

export function optEnum<T extends string>(body: any, field: string, allowed: readonly T[]): T | undefined {
  const v = body[field];
  if (absent(v)) return undefined;
  return allowed.includes(v) ? v : invalid(field);
}

export function required<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === "") throw new InputError(message);
  return value;
}

export const HOSTNAME = /^[a-zA-Z0-9.-]+$/;
export const HOST_OR_IP = /^[a-zA-Z0-9.:[\]-]+$/;
export const PORT = { min: 1, max: 65535, integer: true };

/** Every route expects scalar query values and (for writes) a JSON object body. */
export const requireJsonShape: RequestHandler = (req, _res, next) => {
  for (const [key, value] of Object.entries(req.query)) if (typeof value !== "string") invalid(key);
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      // Bodiless action endpoints (sync, reset, logout …) are sent without a JSON payload
      if (req.body === undefined || Object.keys(req.body ?? {}).length === 0) req.body = {};
      else invalid("JSON body");
    }
  }
  next();
};
