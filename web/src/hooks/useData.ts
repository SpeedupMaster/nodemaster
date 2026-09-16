import { useState, useEffect, useCallback } from "react";
import { NodeItem, RelayLink, SubscriptionToken, LatencyTask, RoutingRule } from "../types";

export function useData() {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [relays, setRelays] = useState<RelayLink[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionToken[]>([]);
  const [latencyTasks, setLatencyTasks] = useState<LatencyTask[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  // Initial Fetch
  const fetchData = useCallback(async () => {
    try {
      const [resNodes, resRelays, resSubs, resTasks, resRules] = await Promise.all([
        fetch("/api/nodes").then((r) => r.json()),
        fetch("/api/relays").then((r) => r.json()),
        fetch("/api/subscriptions").then((r) => r.json()),
        fetch("/api/ping/tasks").then((r) => r.json()),
        fetch("/api/routing/rules").then((r) => r.json()),
      ]);

      if (resNodes.success) setNodes(resNodes.data);
      if (resRelays.success) setRelays(resRelays.data);
      if (resSubs.success) setSubscriptions(resSubs.data);
      if (resTasks.success) setLatencyTasks(resTasks.data);
      if (resRules?.success) setRoutingRules(resRules.data);
    } catch (err) {
      console.error("[useData] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket Live Connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "INIT_STATE") {
            if (msg.nodes) setNodes(msg.nodes);
            if (msg.relays) setRelays(msg.relays);
            if (msg.subscriptions) setSubscriptions(msg.subscriptions);
            if (msg.routingRules) setRoutingRules(msg.routingRules);
          } else if (msg.type === "TELEMETRY_BATCH") {
            if (msg.nodes) setNodes(msg.nodes);
          } else if (msg.type === "NODE_UPDATE" && msg.node) {
            setNodes((prev) =>
              prev.map((n) => (n.id === msg.node.id ? msg.node : n))
            );
          } else if (msg.type === "NODE_DELETED" && msg.id) {
            setNodes((prev) => prev.filter((n) => n.id !== msg.id));
          } else if (msg.type === "RELAYS_UPDATE" && msg.relays) {
            setRelays(msg.relays);
          } else if (msg.type === "ROUTING_RULES_UPDATE" && msg.rules) {
            setRoutingRules(msg.rules);
          }
        } catch (e) {
          console.error("[useData] WS message parse error:", e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  // CRUD API helpers
  const addNode = async (nodeData: Partial<NodeItem>) => {
    const res = await fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nodeData),
    }).then((r) => r.json());
    if (res.success && res.data) {
      setNodes((prev) => (prev.some((n) => n.id === res.data.id) ? prev : [...prev, res.data]));
    }
    return res;
  };

  const updateNode = async (id: string, updates: Partial<NodeItem>) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).then((r) => r.json());
    if (res.success) {
      setNodes((prev) => prev.map((n) => (n.id === id ? res.data : n)));
    }
    return res;
  };

  const deleteNode = async (id: string) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: "DELETE",
    }).then((r) => r.json());
    if (res.success) {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setRelays((prev) => prev.filter((r) => r.transitNodeId !== id && r.exitNodeId !== id));
    }
    return res;
  };

  const resetTraffic = async (id: string) => {
    const res = await fetch(`/api/nodes/${id}/reset-traffic`, {
      method: "POST",
    }).then((r) => r.json());
    if (res.success) {
      setNodes((prev) => prev.map((n) => (n.id === id ? res.data : n)));
    }
    return res;
  };

  const addRelay = async (relayData: Partial<RelayLink>) => {
    const res = await fetch("/api/relays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(relayData),
    }).then((r) => r.json());
    if (res.success && res.data) {
      setRelays((prev) => (prev.some((r) => r.id === res.data.id) ? prev : [...prev, res.data]));
    }
    return res;
  };

  const deleteRelay = async (id: string) => {
    const res = await fetch(`/api/relays/${id}`, {
      method: "DELETE",
    }).then((r) => r.json());
    if (res.success) {
      setRelays((prev) => prev.filter((r) => r.id !== id));
    }
    return res;
  };

  // Latency Tasks API helpers
  const addLatencyTask = async (taskData: Partial<LatencyTask>) => {
    const res = await fetch("/api/ping/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskData),
    }).then((r) => r.json());
    if (res.success && res.data) {
      setLatencyTasks((prev) => (prev.some((t) => t.id === res.data.id) ? prev : [...prev, res.data]));
    }
    return res;
  };

  const updateLatencyTask = async (id: string, updates: Partial<LatencyTask>) => {
    const res = await fetch(`/api/ping/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).then((r) => r.json());
    if (res.success) {
      setLatencyTasks((prev) => prev.map((t) => (t.id === id ? res.data : t)));
    }
    return res;
  };

  const deleteLatencyTask = async (id: string) => {
    const res = await fetch(`/api/ping/tasks/${id}`, {
      method: "DELETE",
    }).then((r) => r.json());
    if (res.success) {
      setLatencyTasks((prev) => prev.filter((t) => t.id !== id));
    }
    return res;
  };

  const resetLatencyTasks = async () => {
    const res = await fetch("/api/ping/tasks/presets", {
      method: "POST",
    }).then((r) => r.json());
    if (res.success) {
      setLatencyTasks(res.data);
    }
    return res;
  };

  // Routing Rules actions
  const addRoutingRule = async (ruleData: Partial<RoutingRule>) => {
    const res = await fetch("/api/routing/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ruleData),
    }).then((r) => r.json());
    if (res.success) {
      setRoutingRules((prev) => [...prev, res.data].sort((a, b) => a.priority - b.priority));
    }
    return res;
  };

  const updateRoutingRule = async (id: string, updates: Partial<RoutingRule>) => {
    const res = await fetch(`/api/routing/rules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).then((r) => r.json());
    if (res.success) {
      setRoutingRules((prev) =>
        prev.map((r) => (r.id === id ? res.data : r)).sort((a, b) => a.priority - b.priority)
      );
    }
    return res;
  };

  const deleteRoutingRule = async (id: string) => {
    const res = await fetch(`/api/routing/rules/${id}`, {
      method: "DELETE",
    }).then((r) => r.json());
    if (res.success) {
      setRoutingRules((prev) => prev.filter((r) => r.id !== id));
    }
    return res;
  };

  const reorderRoutingRules = async (orderedIds: string[]) => {
    const res = await fetch("/api/routing/rules/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: orderedIds }),
    }).then((r) => r.json());
    if (res.success) {
      setRoutingRules(res.data);
    }
    return res;
  };

  const resetRoutingRules = async () => {
    const res = await fetch("/api/routing/rules/presets", {
      method: "POST",
    }).then((r) => r.json());
    if (res.success) {
      setRoutingRules(res.data);
    }
    return res;
  };

  // Aggregated Telemetry
  const totalUplinkSpeed = nodes.reduce((acc, n) => acc + (n.uplinkSpeedBytes || 0), 0);
  const totalDownlinkSpeed = nodes.reduce((acc, n) => acc + (n.downlinkSpeedBytes || 0), 0);
  const totalTrafficUsed = nodes.reduce((acc, n) => acc + (n.trafficUsedBytes || 0), 0);
  const totalTrafficLimit = nodes.reduce((acc, n) => acc + (n.trafficLimitBytes || 0), 0);
  const onlineNodesCount = nodes.filter((n) => n.status === "online").length;

  return {
    nodes,
    relays,
    subscriptions,
    latencyTasks,
    routingRules,
    loading,
    wsConnected,
    fetchData,
    addNode,
    updateNode,
    deleteNode,
    resetTraffic,
    addRelay,
    deleteRelay,
    addLatencyTask,
    updateLatencyTask,
    deleteLatencyTask,
    resetLatencyTasks,
    addRoutingRule,
    updateRoutingRule,
    deleteRoutingRule,
    reorderRoutingRules,
    resetRoutingRules,
    totalUplinkSpeed,
    totalDownlinkSpeed,
    totalTrafficUsed,
    totalTrafficLimit,
    onlineNodesCount,
  };
}

