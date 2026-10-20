import React, { lazy, Suspense, useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useData } from "./hooks/useData";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { OverviewCards } from "./components/dashboard/OverviewCards";
const NodeList = lazy(() => import("./components/nodes/NodeList").then(m => ({ default: m.NodeList })));
const ProbeDashboard = lazy(() => import("./components/probe/ProbeDashboard").then(m => ({ default: m.ProbeDashboard })));
const TopologyCanvas = lazy(() => import("./components/topology/TopologyCanvas").then(m => ({ default: m.TopologyCanvas })));
const SubscriptionView = lazy(() => import("./components/subscription/SubscriptionView").then(m => ({ default: m.SubscriptionView })));
const ScriptView = lazy(() => import("./components/dashboard/ScriptView").then(m => ({ default: m.ScriptView })));
const TelegramNotificationView = lazy(() => import("./components/notifications/TelegramNotificationView").then(m => ({ default: m.TelegramNotificationView })));
import { AddNodeModal } from "./components/nodes/AddNodeModal";
const LatencyMonitorView = lazy(() => import("./components/ping/LatencyMonitorView").then(m => ({ default: m.LatencyMonitorView })));
const NodeDetailModal = lazy(() => import("./components/probe/NodeDetailModal").then(m => ({ default: m.NodeDetailModal })));
import { GlobalTooltip } from "./components/common/Tooltip";
const TrafficAnalyticsView = lazy(() => import("./components/traffic/TrafficAnalyticsView").then(m => ({ default: m.TrafficAnalyticsView })));
import { Broadcast, ArrowUpRight, ArrowDownRight } from "@phosphor-icons/react";
import { Logo } from "./components/common/Logo";
import { NodeItem } from "./types";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./components/auth/LoginPage";
import { PWAStatusBanner } from "./components/common/PWAStatusBanner";

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

/** Placeholder layout shown while a lazily loaded page chunk downloads */
function PageSkeleton() {
  return (
    <div role="status" aria-label="正在加载页面" className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
      <div className="skeleton h-12 rounded-xl" />
      <div className="skeleton h-72 rounded-xl" />
    </div>
  );
}

export function App() {
  const { isAuthenticated, loading: authLoading, token } = useAuth();
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
  } = useData(isAuthenticated, token);

  // Tab switch GSAP transition
  useGSAP(() => {
    if (!mainContentRef.current) return;
    gsap.fromTo(
      mainContentRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", clearProps: "transform,translate,scale,opacity" }
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
      <div className="min-h-screen flex flex-col items-center justify-center text-ink select-none animate-fade-in">
        <Logo size={52} animated className="mb-5 animate-float" />
        <div className="text-sm font-semibold tracking-wide text-ink">NodeMaster 控制中心</div>
        <div className="text-xs text-ink-muted mt-1.5 font-mono">正在验证安全访问凭证...</div>
        <div className="mt-4 w-40 h-0.5 rounded-full bg-paper-3 overflow-hidden">
          <div className="h-full w-full skeleton bg-gradient-accent opacity-80" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <PWAStatusBanner />
      </>
    );
  }

  return (
    <div className="flex min-h-screen text-ink">
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
            <Broadcast weight="duotone" className="w-3.5 h-3.5 text-accent animate-pulse-soft" />
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
            <Suspense fallback={<PageSkeleton />}>
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
            </Suspense>
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
      {selectedNodeDetail && <Suspense fallback={null}><NodeDetailModal
        node={selectedNodeDetail}
        isOpen={!!selectedNodeDetail}
        onClose={() => setSelectedNodeDetail(null)}
      /></Suspense>}

      {/* Global Unified Tooltip Portal & Native Title Interceptor */}
      <GlobalTooltip />

      {/* PWA Status and Install Banner */}
      <PWAStatusBanner />
    </div>
  );
}

export default App;
