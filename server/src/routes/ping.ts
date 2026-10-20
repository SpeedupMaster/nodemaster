import { Router } from "express";
import { db } from "../db/index.js";
import { newId } from "../services/security.js";
import { InputError, notFound, optBoolean, optEnum, optNumber, optString, optStringArray, required } from "../services/validation.js";
import type { LatencyTask } from "../types/index.js";
import { ok } from "./util.js";

export const pingRouter = Router();

const TARGET = /^[a-zA-Z0-9.:[\]-]+$/;

function parseTaskInput(body: any): Partial<LatencyTask> {
  const fields: Partial<LatencyTask> = {
    name: optString(body, "name"),
    target: optString(body, "target", TARGET),
    type: optEnum(body, "type", ["tcp", "icmp"] as const),
    intervalSec: optNumber(body, "intervalSec", { min: 10, max: 86400, integer: true }),
    nodeIds: optStringArray(body, "nodeIds"),
    enabled: optBoolean(body, "enabled"),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

pingRouter.get("/ping/tasks", (_req, res) => ok(res, db.getLatencyTasks()));

pingRouter.post("/ping/tasks", (req, res) => {
  const input = parseTaskInput(req.body);
  const task: LatencyTask = {
    id: newId("task"),
    name: required(input.name, "任务名称与目标地址为必填项"),
    target: required(input.target, "任务名称与目标地址为必填项"),
    type: input.type || "tcp",
    intervalSec: input.intervalSec || 60,
    nodeIds: input.nodeIds || [],
    enabled: input.enabled ?? true,
    order: db.getLatencyTasks().length + 1,
  };
  ok(res, db.addLatencyTask(task));
});

// Registered before /ping/tasks/:id so "presets" and "reorder" are not taken as ids
pingRouter.post("/ping/tasks/presets", (_req, res) => ok(res, db.resetLatencyTasks()));

pingRouter.post("/ping/tasks/reorder", (req, res) => {
  const ids = optStringArray(req.body, "ids");
  if (!ids) throw new InputError("ids 必须为有效数组");
  ok(res, db.reorderLatencyTasks(ids));
});

pingRouter.put("/ping/tasks/:id", (req, res) => {
  ok(res, db.updateLatencyTask(req.params.id, parseTaskInput(req.body)) ?? notFound("任务"));
});

pingRouter.delete("/ping/tasks/:id", (req, res) => {
  if (!db.deleteLatencyTask(req.params.id)) notFound("任务");
  ok(res, undefined, "任务已删除");
});
