import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./routes/util.js";
import { wsHub } from "./services/wsHub.js";
import { db } from "./db/index.js";

const app = express();
const server = http.createServer(app);

// Behind nginx/Caddy set TRUST_PROXY (e.g. "1", "loopback" or a proxy IP) so req.ip and
// req.protocol reflect the real client; otherwise login throttling and generated script URLs break.
const trustProxy = process.env.TRUST_PROXY?.trim();
if (trustProxy && trustProxy !== "false") {
  app.set("trust proxy", trustProxy === "true" ? true : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
} else {
  let warned = false;
  app.use((req, _res, next) => {
    if (!warned && req.headers["x-forwarded-for"]) {
      warned = true;
      console.warn("[Config] Requests arrive through a reverse proxy but TRUST_PROXY is not set; client IPs and https links will be wrong.");
    }
    next();
  });
}
app.disable("x-powered-by");

// Middlewares
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Tokens can appear in subscription/WebSocket URLs; never leak them through Referer.
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  next();
});
app.use(express.json({ limit: "128kb" }));

// Routes
app.use("/api", apiRouter);
// Errors raised before the API router runs (e.g. malformed JSON bodies)
app.use(errorHandler);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "NodeMaster Server", version: "1.0.0" });
});

// Static Web Hosting (Production Build)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIST = path.resolve(__dirname, "../../web/dist");

if (fs.existsSync(WEB_DIST)) {
  app.use(
    express.static(WEB_DIST, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("sw.js")) {
          // Never cache Service Worker file; allow full root scope
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Service-Worker-Allowed", "/");
        } else if (filePath.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          // Vite emits content-hashed file names under /assets
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(WEB_DIST, "index.html"));
  });
}

// Initialize WebSocket Hub
wsHub.init(server);

const PORT = Number(process.env.PORT) || 3880;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`🚀 NodeMaster Control Server is running on:`);
  console.log(`   Local URL  : http://localhost:${PORT}`);
  console.log(`   WebSocket  : ws://localhost:${PORT}/ws`);
  console.log(`   API Base   : http://localhost:${PORT}/api`);
  console.log(`   Install Sh : http://localhost:${PORT}/api/install.sh`);
  console.log(`=======================================================`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  wsHub.close();
  server.close(() => { db.flush(); process.exit(0); });
  setTimeout(() => { db.flush(); process.exit(0); }, 5000).unref();
});
