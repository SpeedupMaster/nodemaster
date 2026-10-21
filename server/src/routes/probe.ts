import { Router, type Request, type Response } from "express";
import fs from "fs";
import { db } from "../db/index.js";
import { asset } from "../paths.js";
import { agentDirectives, ingestTelemetry } from "../services/telemetryService.js";
import { getNodeXrayConfig } from "../services/xrayConfig.js";
import { generateUpgradeScript, getXrayVersionMatrix } from "../services/xrayVersionService.js";
import { HttpError, InputError, optString } from "../services/validation.js";
import { asyncRoute, ok, panelUrl } from "./util.js";

/** Endpoints used by the VPS probe and the install scripts; they authenticate with the node token, not a session. */
export const probeRouter = Router();

const nodeByToken = (token: unknown) => (typeof token === "string" && db.getNodeByToken(token)) || undefined;

probeRouter.post("/nodes/telemetry", (req, res) => {
  const node = nodeByToken(req.body.token);
  if (!node) throw new HttpError(401, "无效节点凭证");
  let updated;
  try {
    updated = ingestTelemetry(node.id, req.body);
  } catch (error: any) {
    throw new InputError(error.message);
  }
  res.json({ success: true, ...agentDirectives(updated) });
});

probeRouter.get("/nodes/by-token/:token", (req, res) => {
  const node = nodeByToken(req.params.token);
  if (!node) throw new HttpError(404, "Token 无效");
  ok(res, node);
});

probeRouter.get("/nodes/by-token/:token/xray-config", (req, res) => {
  const node = nodeByToken(req.params.token);
  if (!node) throw new HttpError(404, "Token 无效或节点不存在");
  if (node.type === "probe" || node.protocol === "probe") {
    return ok(res, { log: { loglevel: "warning" }, inbounds: [], outbounds: [] });
  }
  ok(res, getNodeXrayConfig(node));
});

/** Shell scripts shipped as assets, with the panel's own address filled in. */
function serveScript(name: string) {
  return (req: Request, res: Response) => {
    const raw = fs.readFileSync(asset(name), "utf-8");
    res.type("text/x-shellscript; charset=utf-8").send(raw.replaceAll("{{DEFAULT_PANEL_URL}}", panelUrl(req)));
  };
}

probeRouter.get("/install.sh", serveScript("install.sh"));
probeRouter.get("/update-probe.sh", serveScript("update-probe.sh"));
probeRouter.get("/tcp-tune.sh", serveScript("tcp-tune.sh"));
probeRouter.get("/probe.py", (_req, res) => res.type("text/plain").sendFile(asset("probe.py")));

probeRouter.get("/xray/upgrade.sh", asyncRoute(async (req, res) => {
  const version = optString(req.query, "version") || (await getXrayVersionMatrix()).latestVersion;
  res.type("text/x-shellscript; charset=utf-8").send(generateUpgradeScript(version));
}));
