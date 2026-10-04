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
import { Broadcast, ArrowUpRight, ArrowDownRight, ShareNetwork } from "@phosphor-icons/react";
import { NodeItem } from "./types";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./components/auth/LoginPage";

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>(() => getTabFromUrl());
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<NodeItem | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
    updateRelay,
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
  } = useData(isAuthenticated);

  // Tab switch GSAP transition
  useGSAP(() => {
    if (!mainContentRef.current) return;
    gsap.fromTo(
      mainContentRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.25, ease: "power2.out", clearProps: "transform" }
    );
  }, { dependencies: [currentTab] });

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec > 1024 * 1024) {
      return { val: bytesPerSec / (1024 * 1024), unit: "MB/s" };
    }
    return { val: bytesPerSec / 1024, unit: "KB/s" };
  };

  const mobileUp = formatSpeed(totalUpSpeed);
  const mobileDown = formatSpeed(totalDownSpeed);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center text-ink select-none">
        <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent animate-pulse mb-3.5 shadow-lg shadow-accent/10">
          <ShareNetwork weight="bold" className="w-7 h-7" />
        </div>
        <div className="text-sm font-semibold tracking-wide text-ink">NodeMaster 控制中心</div>
        <div className="text-xs text-ink-muted mt-1.5 font-mono">正在验证安全访问凭证...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      {/* N3 Side-rail Navigation & Mobile Drawer */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        wsConnected={wsConnected}
        totalUpSpeed={totalUpSpeed}
        totalDownSpeed={totalDownSpeed}
        onlineCount={onlineNodesCount}
        totalCount={nodes.length}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Workbench Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentTab={currentTab}
          onOpenAddModal={() => setIsAddNodeOpen(true)}
          onRefresh={fetchData}
          loading={loading}
          onToggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)}
          onOpenMobileMenu={() => setIsMobileNavOpen(true)}
          isMobileMenuOpen={isMobileNavOpen}
        />

        {/* Mobile Global Real-time Throughput (Sticky below Header on mobile < 768px) */}
        <div className="md:hidden sticky top-16 z-10 bg-paper-2/95 backdrop-blur-md border-b border-rule px-4 py-2 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-1.5 font-mono text-ink-muted">
            <Broadcast className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span className="text-[11px] font-medium">全局吞吐</span>
          </div>
          <div className="flex items-center gap-3.5 font-mono text-xs">
            <div className="flex items-center gap-1 text-sky-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span className="text-[10px] text-ink-muted">上行:</span>
              <span className="font-semibold">{mobileUp.val.toFixed(1)} {mobileUp.unit}</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span className="text-[10px] text-ink-muted">下行:</span>
              <span className="font-semibold">{mobileDown.val.toFixed(1)} {mobileDown.unit}</span>
            </div>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
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
                onUpdateRelay={updateRelay}
                onDeleteRelay={deleteRelay}
              />
            )}

            {currentTab === "subscription" && (
              <SubscriptionView
                subscriptions={subscriptions}
                nodes={nodes}
                relays={relays}
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
