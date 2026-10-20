import { Router } from "express";
import { requireAuth } from "../services/authService.js";
import { requireJsonShape } from "../services/validation.js";
import { authPublicRouter, authRouter } from "./auth.js";
import { nodesRouter } from "./nodes.js";
import { pingRouter } from "./ping.js";
import { probeRouter } from "./probe.js";
import { relaysRouter } from "./relays.js";
import { statsRouter } from "./stats.js";
import { subscriptionsPublicRouter, subscriptionsRouter } from "./subscriptions.js";
import { telegramRouter } from "./telegram.js";
import { errorHandler } from "./util.js";

export const apiRouter = Router();

apiRouter.use(requireJsonShape);

// Public: login, client subscriptions, and the probe/installer endpoints (authenticated by node token)
apiRouter.use(authPublicRouter, subscriptionsPublicRouter, probeRouter);

// Everything below requires an admin session
apiRouter.use(requireAuth);
apiRouter.use(authRouter, nodesRouter, relaysRouter, subscriptionsRouter, pingRouter, telegramRouter, statsRouter);
apiRouter.use(errorHandler);
