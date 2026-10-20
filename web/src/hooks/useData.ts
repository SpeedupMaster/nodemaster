import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from "react";
import { NodeItem, NodeInput, RelayLink, SubscriptionToken, LatencyTask } from "../types";
import { api, getStoredToken, signalUnauthorized } from "../services/api";

const WS_RECONNECT_MS = 3000;

// Replaces changed items in place and appends new ones; untouched items keep their object identity
// so memoized children can skip re-rendering.
function mergeById<T extends { id: string }>(prev: T[], changed: T[]): T[] {
  if (!changed.length) return prev;
  const updates = new Map(changed.map((item) => [item.id, item]));
  const next = prev.map((item) => {
    const updated = updates.get(item.id);
    if (!updated) return item;
    updates.delete(item.id);
    return updated;
  });
  return updates.size ? [...next, ...updates.values()] : next;
}

/** Create / update / delete for one REST collection, keeping local state in step with the server. */
function crud<T extends { id: string }, Input = Partial<T>>(path: string, setItems: Dispatch<SetStateAction<T[]>>) {
  return {
    add: async (input: Input) => {
      const item = await api<T>("POST", path, input);
      setItems((prev) => mergeById(prev, [item]));
      return item;
    },
    update: async (id: string, input: Input) => {
      const item = await api<T>("PUT", `${path}/${id}`, input);
      setItems((prev) => mergeById(prev, [item]));
      return item;
    },
    remove: async (id: string) => {
      await api("DELETE", `${path}/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
  };
}

export function useData(enabled: boolean = true, sessionToken?: string | null) {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [relays, setRelays] = useState<RelayLink[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionToken[]>([]);
  const [latencyTasks, setLatencyTasks] = useState<LatencyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled || !getStoredToken()) {
      setLoading(false);
      return;
    }
    try {
      const [nodeList, relayList, subList, taskList] = await Promise.all([
        api<NodeItem[]>("GET", "/api/nodes"),
        api<RelayLink[]>("GET", "/api/relays"),
        api<SubscriptionToken[]>("GET", "/api/subscriptions"),
        api<LatencyTask[]>("GET", "/api/ping/tasks"),
      ]);
      setNodes(nodeList);
      setRelays(relayList);
      setSubscriptions(subList);
      setLatencyTasks(taskList);
    } catch (err) {
      console.error("[useData] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live updates pushed by the server
  useEffect(() => {
    if (!enabled || !getStoredToken()) {
      setWsConnected(false);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const token = getStoredToken();
      if (!token) return;
      ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "INIT_STATE") {
            setNodes(msg.nodes);
            setRelays(msg.relays);
            setSubscriptions(msg.subscriptions);
          } else if (msg.type === "NODES_PATCH") {
            setNodes((prev) => mergeById(prev, msg.nodes));
          } else if (msg.type === "NODE_UPDATE") {
            setNodes((prev) => mergeById(prev, [msg.node]));
          } else if (msg.type === "NODE_DELETED") {
            setNodes((prev) => prev.filter((n) => n.id !== msg.id));
          } else if (msg.type === "RELAYS_UPDATE") {
            setRelays(msg.relays);
          }
        } catch (e) {
          console.error("[useData] WS message parse error:", e);
        }
      };
      ws.onclose = (event) => {
        setWsConnected(false);
        if (event.code === 4001) {
          signalUnauthorized();
          return;
        }
        reconnectTimer = setTimeout(connect, WS_RECONNECT_MS);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [enabled, sessionToken]);

  const nodeApi = crud<NodeItem, NodeInput>("/api/nodes", setNodes);
  const relayApi = crud<RelayLink>("/api/relays", setRelays);
  const subscriptionApi = crud<SubscriptionToken>("/api/subscriptions", setSubscriptions);
  const taskApi = crud<LatencyTask>("/api/ping/tasks", setLatencyTasks);

  const deleteNode = async (id: string) => {
    await nodeApi.remove(id);
    // The server drops the node's relays and its subscription references as well
    setRelays((prev) => prev.filter((r) => r.mainNodeId !== id && r.unlockNodeId !== id));
    setSubscriptions((prev) => prev.map((s) => ({ ...s, nodeIds: s.nodeIds.filter((nodeId) => nodeId !== id) })));
  };

  const resetTraffic = async (id: string) => {
    const node = await api<NodeItem>("POST", `/api/nodes/${id}/reset-traffic`);
    setNodes((prev) => mergeById(prev, [node]));
    return node;
  };

  const resetLatencyTasks = async () => setLatencyTasks(await api<LatencyTask[]>("POST", "/api/ping/tasks/presets"));

  const reorderLatencyTasks = async (orderedIds: string[]) => {
    // Optimistic: listed ids first in the given order, the rest after them
    setLatencyTasks((prev) => {
      const rank = (id: string) => (orderedIds.includes(id) ? orderedIds.indexOf(id) : Infinity);
      return [...prev].sort((a, b) => rank(a.id) - rank(b.id)).map((t, i) => ({ ...t, order: i + 1 }));
    });
    setLatencyTasks(await api<LatencyTask[]>("POST", "/api/ping/tasks/reorder", { ids: orderedIds }));
  };

  return {
    nodes,
    relays,
    subscriptions,
    latencyTasks,
    loading,
    wsConnected,
    fetchData,
    addNode: nodeApi.add,
    updateNode: nodeApi.update,
    deleteNode,
    resetTraffic,
    addRelay: relayApi.add,
    updateRelay: relayApi.update,
    deleteRelay: relayApi.remove,
    addSubscription: subscriptionApi.add,
    updateSubscription: subscriptionApi.update,
    deleteSubscription: subscriptionApi.remove,
    addLatencyTask: taskApi.add,
    updateLatencyTask: taskApi.update,
    deleteLatencyTask: taskApi.remove,
    resetLatencyTasks,
    reorderLatencyTasks,
    totalUplinkSpeed: nodes.reduce((acc, n) => acc + (n.uplinkSpeedBytes || 0), 0),
    totalDownlinkSpeed: nodes.reduce((acc, n) => acc + (n.downlinkSpeedBytes || 0), 0),
    totalTrafficUsed: nodes.reduce((acc, n) => acc + (n.trafficUsedBytes || 0), 0),
    totalTrafficLimit: nodes.reduce((acc, n) => acc + (n.trafficLimitBytes || 0), 0),
    onlineNodesCount: nodes.filter((n) => n.status === "online").length,
  };
}
