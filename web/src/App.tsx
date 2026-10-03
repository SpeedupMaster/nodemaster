import React, { useState, useRef } from "react";
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
import { NodeItem } from "./types";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · theme: Cobalt · enrichment: E2-telemetry-stream · nav: N3 · footer: Ft2 */
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */

gsap.registerPlugin(useGSAP);

export function App() {
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<NodeItem | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

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
        onSelectTab={setCurrentTab}
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
              />
            )}

            {currentTab === "ping" && (
              <LatencyMonitorView
                tasks={latencyTasks}
                nodes={nodes}
                onAddTask={addLatencyTask}
                onUpdateTask={updateLatencyTask}
                onDeleteTask={deleteLatencyTask}
                onResetTasks={resetLatencyTasks}
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
