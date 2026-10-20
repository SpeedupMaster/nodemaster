import { Router } from "express";
import { db, makeSubscription } from "../db/index.js";
import { assembleProxies, renderBase64, renderClashYaml, renderEgernYaml, renderSingboxJson } from "../services/subscription.js";
import { InputError, notFound, optNumber, optString, optStringArray } from "../services/validation.js";
import type { SubscriptionToken } from "../types/index.js";
import { ok, panelUrl } from "./util.js";

const TOKEN = /^[a-zA-Z0-9_-]{16,128}$/;
const HTTP_URL = /^https?:\/\/[^\s]+$/;

function parseSubscriptionInput(body: any): Partial<SubscriptionToken> {
  const token = optString(body, "token");
  // Subscription tokens are the only credential guarding node secrets; keep them unguessable
  if (token !== undefined && !TOKEN.test(token)) throw new InputError("Token 需为 16–128 位字母、数字、下划线或连字符");
  const customHost = optString(body, "customHost");
  if (customHost && !HTTP_URL.test(customHost)) throw new InputError("自定义域名需以 http:// 或 https:// 开头");
  const nodeIds = optStringArray(body, "nodeIds");
  if (nodeIds?.some((id) => !db.getNodeById(id))) throw new InputError("参数无效: nodeIds");
  const fields: Partial<SubscriptionToken> = {
    name: optString(body, "name"),
    token,
    nodeIds,
    // Unix seconds; 0 = never expires
    expireAt: optNumber(body, "expireAt", { integer: true }),
    customHost: customHost?.replace(/\/+$/, ""),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

export const subscriptionsRouter = Router();

subscriptionsRouter.get("/subscriptions", (_req, res) => ok(res, db.getSubscriptions()));

subscriptionsRouter.post("/subscriptions", (req, res) => {
  const input = parseSubscriptionInput(req.body);
  const sub = { ...makeSubscription(), ...input };
  if (input.token && db.getSubscriptionByToken(input.token)) throw new InputError("Token 已被占用，请更换其他 Token");
  ok(res, db.addSubscription(sub));
});

subscriptionsRouter.put("/subscriptions/:id", (req, res) => {
  ok(res, db.updateSubscription(req.params.id, parseSubscriptionInput(req.body)) ?? notFound("订阅"));
});

subscriptionsRouter.delete("/subscriptions/:id", (req, res) => {
  if (!db.deleteSubscription(req.params.id)) notFound("订阅");
  ok(res, undefined, "订阅已删除");
});

// ---------------------------------------------------------------------------------------------
// Public client endpoint: format picked by ?format= or the client's User-Agent
// ---------------------------------------------------------------------------------------------

type Format = "clash" | "singbox" | "egern" | "base64";
const UA_FORMATS: [RegExp, Format][] = [
  [/clash|mihomo|stash/, "clash"],
  [/sing-?box/, "singbox"],
  [/egern/, "egern"],
];

export const subscriptionsPublicRouter = Router();

subscriptionsPublicRouter.get("/sub/:token", (req, res) => {
  const sub = db.getSubscriptionByToken(req.params.token);
  if (!sub) return res.status(404).send("Subscription not found.");
  if (sub.expireAt > 0 && sub.expireAt <= Math.floor(Date.now() / 1000)) return res.status(403).send("Subscription expired.");

  const nodes = sub.nodeIds.length ? db.getNodes().filter((n) => sub.nodeIds.includes(n.id)) : db.getNodes();
  const proxies = assembleProxies(nodes, db.getRelays());

  // Usage shown by clients is the traffic measured on the included nodes in their current billing periods
  const used = nodes.reduce((sum, n) => sum + n.trafficUsedBytes, 0);
  const total = nodes.reduce((sum, n) => sum + n.trafficLimitBytes, 0);
  res.setHeader("Subscription-Userinfo", `upload=0; download=${used}; total=${total}; expire=${sub.expireAt}`);
  res.setHeader("profile-web-page-url", panelUrl(req));

  const requested = String(req.query.format || "").toLowerCase();
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const format: Format = (["clash", "singbox", "egern"].includes(requested) ? requested as Format : undefined)
    ?? (requested ? "base64" : UA_FORMATS.find(([pattern]) => pattern.test(ua))?.[1] ?? "base64");
  const attachment = `inline; filename="nodemaster_${sub.id}.yaml"; filename*=UTF-8''${encodeURIComponent(sub.name)}.yaml`;

  switch (format) {
    case "clash":
      res.type("text/yaml; charset=utf-8").setHeader("Content-Disposition", attachment);
      return res.send(renderClashYaml(proxies));
    case "singbox":
      return res.type("application/json; charset=utf-8").send(renderSingboxJson(proxies));
    case "egern":
      res.type("text/yaml; charset=utf-8").setHeader("Content-Disposition", attachment);
      return res.send(renderEgernYaml(proxies, `${sub.customHost || panelUrl(req)}/api/sub/${sub.token}?format=egern`));
    default:
      return res.type("text/plain; charset=utf-8").send(renderBase64(proxies));
  }
});
