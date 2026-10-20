import { Router } from "express";
import { getTrafficAnalytics, TRAFFIC_RANGES } from "../services/trafficService.js";
import { batchUpgradeXray, getXrayVersionMatrix, upgradeNodeXray } from "../services/xrayVersionService.js";
import { optEnum, optString } from "../services/validation.js";
import { asyncRoute, ok } from "./util.js";

/** Traffic analytics and Xray-core version management. */
export const statsRouter = Router();

statsRouter.get("/traffic/analytics", (req, res) => {
  ok(res, getTrafficAnalytics(optEnum(req.query, "range", TRAFFIC_RANGES) || "today"));
});

statsRouter.get("/traffic/export", (req, res) => {
  const range = optEnum(req.query, "range", TRAFFIC_RANGES) || "month";
  res.setHeader("Content-Disposition", `attachment; filename="nodemaster-traffic-${range}-${Date.now()}.json"`);
  res.type("application/json").send(JSON.stringify(getTrafficAnalytics(range), null, 2));
});

statsRouter.get("/xray/version", asyncRoute(async (req, res) => {
  ok(res, await getXrayVersionMatrix(req.query.refresh === "true"));
}));

statsRouter.post("/nodes/batch-upgrade-xray", asyncRoute(async (req, res) => {
  ok(res, await batchUpgradeXray(optString(req.body, "version")));
}));

statsRouter.post("/nodes/:id/upgrade-xray", asyncRoute(async (req, res) => {
  ok(res, await upgradeNodeXray(String(req.params.id), optString(req.body, "version")));
}));
