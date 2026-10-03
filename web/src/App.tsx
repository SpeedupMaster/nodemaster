import React, { useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useData } from "./hooks/useData";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { OverviewCards } from "./components/dashboard/OverviewCards";
import { NodeList } from "./components/nodes/NodeList";
import { ProbeDashboard } from "./components/probe/ProbeDashboard";
import { TopologyCanvas } from "./components/topology/TopologyCanvas";
import { SubscriptionView } from "./components/subscription/SubscriptionView";
import { ScriptView } from "./components/dashboard/ScriptView";
import { TelegramNotificationView } from "./components/notifications/TelegramNotificationView";
import { AddNodeModal } from "./components/nodes/AddNodeModal";
import { LatencyMonitorView } from "./components/ping/LatencyMonitorView";
import { NodeDetailModal } from "./components/probe/NodeDetailModal";
import { GlobalTooltip } from "./components/common/Tooltip";
import { TrafficAnalyticsView } from "./components/traffic/TrafficAnalyticsView";
import { NodeItem } from "./types";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · theme: Cobalt · enrichment: E2-telemetry-stream · nav: N3 · footer: Ft2 */
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */

gsap.registerPlugin(useGSAP);

const VALID_TABS = [
  "dashboard",
  "nodes",
  "traffic",
  "ping",
  "topology",
  "subscription",
  "script",
  "notifications",
] as const;

const TAB_TITLES: Record<string, string> = {
  dashboard: "实时仪表盘",
  nodes: "多 VPS 节点管理",
  traffic: "业务流量统计与服务分析",
  ping: "延迟监测",
  topology: "链式代理与解锁拓扑",
  subscription: "订阅分享与客户端导出",
  script: "一键部署与脚本",
  notifications: "Telegram 告警通知",
};

const getTabFromUrl = (): string => {
  if (typeof window === "undefined") return "dashboard";
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (path && (VALID_TABS as readonly string[]).includes(path)) {
    return path;
  }
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash && (VALID_TABS as readonly string[]).includes(hash)) {
    return hash;
  }
  return "dashboard";
};

export function App() {
  const [currentTab, setCurrentTab] = useState<string>(() => getTabFromUrl());
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<NodeItem | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const handleSelectTab = useCallback((tab: string) => {
    setCurrentTab(tab);
    const targetPath = tab === "dashboard" ? "/" : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, "", targetPath);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(getTabFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const title = TAB_TITLES[currentTab];
    if (title) {
      document.title = `${title} - NodeMaster`;
    } else {
      document.title = "NodeMaster - 多 VPS 节点与智能分流控制台";
    }
  }, [currentTab]);

  const {
    nodes,
    relays,
    subscriptions,
    latencyTasks,
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
    reorderLatencyTasks,
    updateSubscription,
    totalUplinkSpeed: totalUpSpeed,
    totalDownlinkSpeed: totalDownSpeed,
    totalTrafficUsed,
    totalTrafficLimit,
    onlineNodesCount,
  } = useData();

  // Tab switch GSAP transition
  useGSAP(() => {
    if (!mainContentRef.current) return;
    gsap.fromTo(
      mainContentRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.25, ease: "power2.out", clearProps: "transform" }
    );
  }, { dependencies: [currentTab] });

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      {/* N3 Side-rail Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        wsConnected={wsConnected}
        totalUpSpeed={totalUpSpeed}
        totalDownSpeed={totalDownSpeed}
        onlineCount={onlineNodesCount}
        totalCount={nodes.length}
      />

      {/* Main Workbench Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentTab={currentTab}
          onOpenAddModal={() => setIsAddNodeOpen(true)}
          onRefresh={fetchData}
          loading={loading}
        />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          <div ref={mainContentRef}>
            {currentTab === "dashboard" && (
              <div className="space-y-6">
                <OverviewCards
                  totalTrafficUsed={totalTrafficUsed}
                  totalTrafficLimit={totalTrafficLimit}
                  totalUpSpeed={totalUpSpeed}
                  totalDownSpeed={totalDownSpeed}
                  onlineCount={onlineNodesCount}
                  totalCount={nodes.length}
                  relaysCount={relays.length}
                />
                <ProbeDashboard
                  nodes={nodes}
                  onSelectNode={(node) => setSelectedNodeDetail(node)}
                />
              </div>
            )}

            {currentTab === "nodes" && (
              <NodeList
                nodes={nodes}
                onResetTraffic={resetTraffic}
                onDelete={deleteNode}
                onUpdate={updateNode}
                onRefreshData={fetchData}
              />
            )}

            {currentTab === "traffic" && (
              <TrafficAnalyticsView nodes={nodes} />
            )}

            {currentTab === "ping" && (
              <LatencyMonitorView
                tasks={latencyTasks}
                nodes={nodes}
                onAddTask={addLatencyTask}
                onUpdateTask={updateLatencyTask}
                onDeleteTask={deleteLatencyTask}
                onResetTasks={resetLatencyTasks}
                onReorderTasks={reorderLatencyTasks}
                onOpenNodeDetail={(node) => setSelectedNodeDetail(node)}
              />
            )}

            {currentTab === "topology" && (
              <TopologyCanvas
                nodes={nodes}
                relays={relays}
                onAddRelay={addRelay}
                onDeleteRelay={deleteRelay}
              />
            )}

            {currentTab === "subscription" && (
              <SubscriptionView
                subscriptions={subscriptions}
                nodes={nodes}
                onUpdateSubscription={updateSubscription}
              />
            )}

            {currentTab === "script" && <ScriptView />}

            {currentTab === "notifications" && (
              <TelegramNotificationView nodes={nodes} />
            )}
          </div>
        </main>

        <Footer />
      </div>

      {/* Global Add Node Modal */}
      <AddNodeModal
        isOpen={isAddNodeOpen}
        onClose={() => setIsAddNodeOpen(false)}
        onSubmit={addNode}
      />

      {/* Global Node Detail & Latency Time Series Modal */}
      <NodeDetailModal
        node={selectedNodeDetail}
        isOpen={!!selectedNodeDetail}
        onClose={() => setSelectedNodeDetail(null)}
      />

      {/* Global Unified Tooltip Portal & Native Title Interceptor */}
      <GlobalTooltip />
    </div>
  );
}

export default App;
