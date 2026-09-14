import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { db } from "../db/index.js";
import { NodeItem } from "../types/index.js";

export class WsHub {
  private wss: WebSocketServer | null = null;
  private agentClients = new Map<string, WebSocket>(); // nodeId -> WebSocket
  private webClients = new Set<WebSocket>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const clientType = url.searchParams.get("type"); // "web" | "agent"
      const token = url.searchParams.get("token");

      if (clientType === "agent" && token) {
        // Agent connection
        const node = db.getNodeByToken(token);
        if (!node) {
          ws.close(4001, "Invalid Agent Token");
          return;
        }

        this.agentClients.set(node.id, ws);
        db.updateNode(node.id, { status: "online", lastSeen: Date.now() });
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
          this.agentClients.delete(node.id);
          db.updateNode(node.id, { status: "offline" });
          this.broadcastNodeUpdate(node.id);
        });
      } else {
        // Web Dashboard Client
        this.webClients.add(ws);
        // Send initial full state
        ws.send(JSON.stringify({
          type: "INIT_STATE",
          nodes: db.getNodes(),
          relays: db.getRelays(),
          subscriptions: db.getSubscriptions(),
        }));

        ws.on("close", () => {
          this.webClients.delete(ws);
        });
      }
    });

    // Start background telemetry simulation/check every 3 seconds
    this.startBackgroundTelemetry();
  }

  private handleAgentReport(nodeId: string, data: Partial<NodeItem>) {
    const node = db.getNodeById(nodeId);
    if (!node) return;

    const updates: Partial<NodeItem> = {
      lastSeen: Date.now(),
      status: "online",
      cpuUsage: typeof data.cpuUsage === "number" ? data.cpuUsage : node.cpuUsage,
      memUsage: typeof data.memUsage === "number" ? data.memUsage : node.memUsage,
      diskUsage: typeof data.diskUsage === "number" ? data.diskUsage : node.diskUsage,
      uplinkSpeedBytes: typeof data.uplinkSpeedBytes === "number" ? data.uplinkSpeedBytes : node.uplinkSpeedBytes,
      downlinkSpeedBytes: typeof data.downlinkSpeedBytes === "number" ? data.downlinkSpeedBytes : node.downlinkSpeedBytes,
      trafficUsedBytes: (node.trafficUsedBytes || 0) + (data.trafficUsedBytes || 0),
    };

    // Circuit Breaker check
    const config = db.getConfig();
    if (config.autoCircuitBreaker && node.trafficLimitBytes > 0) {
      const pct = (updates.trafficUsedBytes! / node.trafficLimitBytes) * 100;
      if (pct >= config.circuitBreakerThresholdPct) {
        updates.status = "circuit_broken";
      }
    }

    db.updateNode(nodeId, updates);
    this.broadcastNodeUpdate(nodeId);
  }

  private startBackgroundTelemetry() {
    this.heartbeatTimer = setInterval(() => {
      const nodes = db.getNodes();
      const config = db.getConfig();

      for (const node of nodes) {
        if (node.status === "online") {
          // Dynamic slight jitter to telemetry for realistic live experience
          const cpuDelta = (Math.random() - 0.5) * 4;
          const newCpu = Math.max(5, Math.min(95, +(node.cpuUsage + cpuDelta).toFixed(1)));
          const speedFactor = 0.8 + Math.random() * 0.4;
          const upSpeed = Math.floor(node.uplinkSpeedBytes * speedFactor);
          const downSpeed = Math.floor(node.downlinkSpeedBytes * speedFactor);
          const addedTraffic = Math.floor((upSpeed + downSpeed) * 3);
          const newTotalTraffic = node.trafficUsedBytes + addedTraffic;

          let newStatus = node.status;
          if (config.autoCircuitBreaker && node.trafficLimitBytes > 0) {
            const pct = (newTotalTraffic / node.trafficLimitBytes) * 100;
            if (pct >= config.circuitBreakerThresholdPct) {
              newStatus = "circuit_broken";
            }
          }

          db.updateNode(node.id, {
            cpuUsage: newCpu,
            uplinkSpeedBytes: upSpeed,
            downlinkSpeedBytes: downSpeed,
            trafficUsedBytes: newTotalTraffic,
            status: newStatus,
            lastSeen: Date.now(),
          });
        }
      }

      this.broadcastToWeb({
        type: "TELEMETRY_BATCH",
        nodes: db.getNodes(),
        timestamp: Date.now(),
      });
    }, 3000);
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
    const str = JSON.stringify(payload);
    for (const client of this.webClients) {
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
}

export const wsHub = new WsHub();
