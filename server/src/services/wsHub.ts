import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { db } from "../db/index.js";
import type { NodeItem } from "../types/index.js";
import { HEARTBEAT_MS } from "../constants.js";
import { telegramService } from "./telegramService.js";
import { maintainNodes } from "./telemetryService.js";
import { verifyToken } from "./authService.js";

/**
 * Pushes live state to dashboard browsers. Probes never connect here: they report over HTTP
 * (/api/nodes/telemetry) and receive their directives in the response.
 */
export class WsHub {
  private wss: WebSocketServer | null = null;
  private webClients = new Map<WebSocket, string>(); // socket -> session token
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastSent = new Map<string, string>(); // nodeId -> last JSON pushed to browsers

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws", maxPayload: 128 * 1024 });

    this.wss.on("connection", (ws, req) => {
      ws.on("error", (error) => console.error("WebSocket error", error.message));
      // Browsers cannot set headers on a WebSocket upgrade, so the session token travels in the query
      const token = new URL(req.url || "/ws", "http://localhost").searchParams.get("token") || "";
      if (!verifyToken(token).valid) {
        ws.close(4001, "Unauthorized Web Client");
        return;
      }

      this.webClients.set(ws, token);
      ws.send(JSON.stringify({ type: "INIT_STATE", nodes: db.getNodes(), relays: db.getRelays(), subscriptions: db.getSubscriptions() }));
      ws.on("close", () => this.webClients.delete(ws));
    });

    this.heartbeatTimer = setInterval(() => {
      maintainNodes();
      this.closeRevokedClients();
      this.broadcastChangedNodes();
      telegramService.checkNodeAlerts(db.getNodes()).catch(console.error);
    }, HEARTBEAT_MS);
    this.heartbeatTimer.unref();
  }

  public closeRevokedClients() {
    for (const [client, token] of this.webClients) {
      if (!verifyToken(token).valid) { client.close(4001, "Session revoked"); this.webClients.delete(client); }
    }
  }

  public close() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const client of this.webClients.keys()) client.terminate();
    this.wss?.close();
  }

  /** Sends only nodes whose state changed since they were last pushed to browsers. */
  private broadcastChangedNodes() {
    if (!this.webClients.size) return;
    const changed: NodeItem[] = [];
    const present = new Set<string>();
    for (const node of db.getNodes()) {
      present.add(node.id);
      const json = JSON.stringify(node);
      if (this.lastSent.get(node.id) !== json) { this.lastSent.set(node.id, json); changed.push(node); }
    }
    for (const id of this.lastSent.keys()) if (!present.has(id)) this.lastSent.delete(id);
    if (changed.length) this.broadcastToWeb({ type: "NODES_PATCH", nodes: changed, timestamp: Date.now() });
  }

  public broadcastNodeUpdate(nodeId: string) {
    const node = db.getNodeById(nodeId);
    if (!node) return;
    this.lastSent.set(node.id, JSON.stringify(node));
    this.broadcastToWeb({ type: "NODE_UPDATE", node });
  }

  public broadcastRelays() {
    this.broadcastToWeb({ type: "RELAYS_UPDATE", relays: db.getRelays() });
  }

  public broadcastToWeb(payload: object) {
    const str = JSON.stringify(payload);
    for (const client of this.webClients.keys()) {
      if (client.readyState === WebSocket.OPEN) client.send(str);
    }
  }
}

export const wsHub = new WsHub();
