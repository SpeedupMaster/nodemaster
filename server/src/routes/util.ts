import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from "express";
import { HttpError } from "../services/validation.js";

/** Express 4 does not forward rejected promises to the error handler; this does. */
export const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

/** Origin the request reached the panel at; used in generated scripts and subscription URLs. */
export const panelUrl = (req: Request) => `${req.protocol}://${req.get("host")}`;

export const ok = (res: Response, data?: unknown, message?: string) => res.json({ success: true, data, message });

/** HttpErrors carry a client-safe message; anything else is logged and reported generically. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  // body-parser errors (malformed JSON, oversized body) carry their own 4xx status
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error("Request failed", error);
  res.status(status).json({ success: false, message: status === 500 ? "服务暂时不可用，请稍后重试" : "请求数据格式不正确" });
};
