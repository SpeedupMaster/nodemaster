import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { db } from "../db/index.js";
import { NodeItem } from "../types/index.js";
import { telegramService } from "./telegramService.js";
import { ingestTelemetry, maintainNodes, agentDirectives } from "./telemetryService.js";
import { verifyToken } from "./authService.js";

export class WsHub {
  private wss: WebSocketServer | null = null;
  private agentClients = new Map<string, WebSocket>(); // nodeId -> WebSocket
  private webClients = new Map<WebSocket, string>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws", maxPayload: 128 * 1024 });

    this.wss.on("connection", (ws, req) => {
      ws.on("error", (error) => console.error("WebSocket error", error.message));
      const url = new URL(req.url || "/ws", "http://localhost");
      const clientType = url.searchParams.get("type"); // "web" | "agent"
      const token = url.searchParams.get("token");

      if (clientType === "agent" && token) {
        // Agent connection
        const node = db.getNodeByToken(token);
        if (!node) {
          ws.close(4001, "Invalid Agent Token");
          return;
        }

        const previous = this.agentClients.get(node.id);
        this.agentClients.set(node.id, ws);
        previous?.close(4000, "Replaced connection");
        db.updateNode(node.id, { status: node.status === "circuit_broken" ? node.status : "online", lastSeen: Date.now() }, true);
        this.broadcastNodeUpdate(node.id);

        ws.on("message", (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            this.handleAgentReport(node.id, data);
          } catch (err) {
            console.error("[WsHub] Parse agent report error:", err);
          }
        });

        ws.on("close", () => {
          if (this.agentClients.get(node.id) !== ws) return;
          this.agentClients.delete(node.id);
          db.updateNode(node.id, { status: db.getNodeById(node.id)?.status === "circuit_broken" ? "circuit_broken" : "offline" }, true);
          this.broadcastNodeUpdate(node.id);
          telegramService.checkNodeAlerts(db.getNodes()).catch(() => {});
        });
      } else {
        // Web Dashboard Client - Require valid Admin JWT Token
        const authResult = verifyToken(token || "");
        if (!authResult.valid) {
          ws.close(4001, "Unauthorized Web Client");
          return;
        }

        this.webClients.set(ws, token!);
        // Send initial full state
        ws.send(JSON.stringify({
          type: "INIT_STATE",
          nodes: db.getNodes(),
          relays: db.getRelays(),
          subscriptions: db.getSubscriptions(),
          routingRules: db.getRoutingRules(),
        }));

        ws.on("close", () => {
          this.webClients.delete(ws);
        });
      }
    });

    // Only age real telemetry; never invent measurements or refresh agent heartbeats.
    this.startBackgroundTelemetry();
  }

  private handleAgentReport(nodeId: string, data: Partial<NodeItem>) {
    const node = ingestTelemetry(nodeId, data);
    this.agentClients.get(nodeId)?.send(JSON.stringify({ type: "DIRECTIVES", ...agentDirectives(node) }));
    this.broadcastNodeUpdate(nodeId);
  }

  public closeRevokedClients() {
    for (const [client, token] of this.webClients) {
      if (!verifyToken(token).valid) { client.close(4001, "Session revoked"); this.webClients.delete(client); }
    }
  }

  private startBackgroundTelemetry() {
    this.heartbeatTimer = setInterval(() => {
      maintainNodes();
      this.closeRevokedClients();
      this.broadcastToWeb({ type: "TELEMETRY_BATCH", nodes: db.getNodes(), timestamp: Date.now() });
      telegramService.checkNodeAlerts(db.getNodes()).catch(console.error);
    }, 3000);
    this.heartbeatTimer.unref();
  }

  public close() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const client of this.webClients.keys()) client.terminate();
    for (const client of this.agentClients.values()) client.terminate();
    this.wss?.close();
  }

  public broadcastNodeUpdate(nodeId: string) {
    const node = db.getNodeById(nodeId);
    if (!node) return;
    this.broadcastToWeb({
      type: "NODE_UPDATE",
      node,
    });
  }

  public broadcastToWeb(payload: any) {
    this.closeRevokedClients();
    const str = JSON.stringify(payload);
    for (const client of this.webClients.keys()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    }
  }

  public pushConfigToAgent(nodeId: string, xrayConfig: any): boolean {
    const ws = this.agentClients.get(nodeId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "CONFIG_RELOAD",
        config: xrayConfig,
      }));
      return true;
    }
    return false;
  }

  public pushUpgradeToAgent(nodeId: string, targetVersion: string): boolean {
    const ws = this.agentClients.get(nodeId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "XRAY_UPGRADE",
        version: targetVersion,
      }));
      return true;
    }
    return false;
  }
}

export const wsHub = new WsHub();
