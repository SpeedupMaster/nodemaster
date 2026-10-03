import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { db } from "../db/index.js";
import { NodeItem } from "../types/index.js";
import { telegramService } from "./telegramService.js";

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
          telegramService.checkNodeAlerts(db.getNodes()).catch(() => {});
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
          routingRules: db.getRoutingRules(),
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

          let newStatus: NodeItem["status"] = node.status;
          if (config.autoCircuitBreaker && node.trafficLimitBytes > 0) {
            const pct = (newTotalTraffic / node.trafficLimitBytes) * 100;
            if (pct >= config.circuitBreakerThresholdPct) {
              newStatus = "circuit_broken";
            }
          }

          const memTotal = node.memTotalBytes || 2147483648;
          const memUsed = Math.floor(memTotal * (node.memUsage / 100));
          const load1 = +(Math.max(0.01, (node.cpuUsage / 100) * 1.5 + (Math.random() - 0.5) * 0.05)).toFixed(2);
          const load5 = +(Math.max(0.01, (node.loadAvg ? node.loadAvg[1] : 0.2) + (Math.random() - 0.5) * 0.02)).toFixed(2);
          const load15 = +(Math.max(0.01, (node.loadAvg ? node.loadAvg[2] : 0.18) + (Math.random() - 0.5) * 0.01)).toFixed(2);

          db.updateNode(node.id, {
            cpuUsage: newCpu,
            uplinkSpeedBytes: upSpeed,
            downlinkSpeedBytes: downSpeed,
            trafficUsedBytes: newTotalTraffic,
            status: newStatus,
            loadAvg: [load1, load5, load15],
            memTotalBytes: memTotal,
            memUsedBytes: memUsed,
            lastSeen: Date.now(),
          });
        }
      }

      this.broadcastToWeb({
        type: "TELEMETRY_BATCH",
        nodes: db.getNodes(),
        timestamp: Date.now(),
      });

      // Periodically check Telegram alert rules
      telegramService.checkNodeAlerts(db.getNodes()).catch((err) => {
        console.error("[TelegramAlerts] Error:", err);
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
