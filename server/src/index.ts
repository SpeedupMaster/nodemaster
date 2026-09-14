import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { apiRouter } from "./routes/api.js";
import { wsHub } from "./services/wsHub.js";
import { db } from "./db/index.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({ origin: "*" }));
app.use(express.json());

// Routes
app.use("/api", apiRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "NodeMaster Server",
    version: "1.0.0",
    nodesCount: db.getNodes().length,
  });
});

// Static Web Hosting (Production Build)
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIST = path.resolve(__dirname, "../../web/dist");

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    res.sendFile(path.join(WEB_DIST, "index.html"));
  });
}

// Initialize WebSocket Hub
wsHub.init(server);

const PORT = Number(process.env.PORT) || db.getConfig().port || 3880;
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
