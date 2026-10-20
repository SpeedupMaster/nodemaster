import { Router, type Response } from "express";
import { db } from "../db/index.js";
import { telegramService } from "../services/telegramService.js";
import { HttpError, optBoolean, optEnum, optNumber, optString } from "../services/validation.js";
import type { TelegramAlertType, TelegramConfig } from "../types/index.js";
import { asyncRoute, ok } from "./util.js";

export const telegramRouter = Router();

const PERCENT = { min: 1, max: 100 };
const ALERT_TYPES: readonly TelegramAlertType[] = ["offline", "recovery", "traffic", "renewal", "cpu", "mem", "test"];
const HTTP_URL = /^https?:\/\/[^\s]+$/;

/** Only known settings are accepted, so a request can never plant arbitrary keys in the stored config. */
function parseTelegramConfig(body: any): Partial<TelegramConfig> {
  const fields: Partial<TelegramConfig> = {
    enabled: optBoolean(body, "enabled"),
    botToken: optString(body, "botToken"),
    chatId: optString(body, "chatId"),
    apiEndpoint: optString(body, "apiEndpoint", HTTP_URL),
    offlineAlert: optBoolean(body, "offlineAlert"),
    trafficAlert: optBoolean(body, "trafficAlert"),
    trafficThresholdPercent: optNumber(body, "trafficThresholdPercent", PERCENT),
    renewalAlert: optBoolean(body, "renewalAlert"),
    renewalDaysAhead: optNumber(body, "renewalDaysAhead", { min: 1, max: 365, integer: true }),
    cpuAlert: optBoolean(body, "cpuAlert"),
    cpuThresholdPercent: optNumber(body, "cpuThresholdPercent", PERCENT),
    memAlert: optBoolean(body, "memAlert"),
    memThresholdPercent: optNumber(body, "memThresholdPercent", PERCENT),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== ""));
}

telegramRouter.get("/telegram/config", (_req, res) => ok(res, db.getTelegramConfig()));

telegramRouter.put("/telegram/config", (req, res) => ok(res, db.updateTelegramConfig(parseTelegramConfig(req.body))));

/** Tests the credentials in the request (falling back to the saved ones) without saving them. */
/** A failed delivery is the upstream's fault: 502 with Telegram's own error text. */
async function sendSample(res: Response, delivery: Promise<{ success: boolean; error?: string; message?: string }>) {
  const result = await delivery;
  if (!result.success) throw new HttpError(502, result.error || "Telegram 推送失败");
  ok(res, undefined, result.message);
}

telegramRouter.post("/telegram/test", asyncRoute(async (req, res) => {
  await sendSample(res, telegramService.simulateAlert("test", undefined, parseTelegramConfig(req.body)));
}));

telegramRouter.post("/telegram/simulate", asyncRoute(async (req, res) => {
  await sendSample(res, telegramService.simulateAlert(optEnum(req.body, "type", ALERT_TYPES) || "test", optString(req.body, "nodeId")));
}));

telegramRouter.get("/telegram/logs", (_req, res) => ok(res, db.getTelegramLogs()));

telegramRouter.delete("/telegram/logs", (_req, res) => {
  db.clearTelegramLogs();
  ok(res, undefined, "推送历史已清空");
});
