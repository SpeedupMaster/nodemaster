import { lazy, Suspense, useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useData } from "./hooks/useData";
import type { NodeItem } from "./types";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { CommandPalette } from "./components/layout/CommandPalette";
import { OverviewCards } from "./components/dashboard/OverviewCards";
const NodeList = lazy(() => import("./components/nodes/NodeList").then(m => ({ default: m.NodeList })));
const ProbeDashboard = lazy(() => import("./components/probe/ProbeDashboard").then(m => ({ default: m.ProbeDashboard })));
const TopologyCanvas = lazy(() => import("./components/topology/TopologyCanvas").then(m => ({ default: m.TopologyCanvas })));
const SubscriptionView = lazy(() => import("./components/subscription/SubscriptionView").then(m => ({ default: m.SubscriptionView })));
const ScriptView = lazy(() => import("./components/dashboard/ScriptView").then(m => ({ default: m.ScriptView })));
const TelegramNotificationView = lazy(() => import("./components/notifications/TelegramNotificationView").then(m => ({ default: m.TelegramNotificationView })));
import { NodeForm } from "./components/nodes/NodeForm";
const LatencyMonitorView = lazy(() => import("./components/ping/LatencyMonitorView").then(m => ({ default: m.LatencyMonitorView })));
const NodeDetailPage = lazy(() => import("./components/probe/NodeDetailPage").then(m => ({ default: m.NodeDetailPage })));
import { GlobalTooltip } from "./components/common/Tooltip";
const TrafficAnalyticsView = lazy(() => import("./components/traffic/TrafficAnalyticsView").then(m => ({ default: m.TrafficAnalyticsView })));
import { Logo } from "./components/common/Logo";
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
  traffic: "流量统计",
  ping: "延迟监测",
  topology: "链式代理与解锁拓扑",
  subscription: "订阅分享与客户端导出",
  script: "一键部署与脚本",
  notifications: "Telegram 告警通知",
};

const getTabFromUrl = (): string => {
  if (typeof window === "undefined") return "dashboard";
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0].toLowerCase();
  if (path && (VALID_TABS as readonly string[]).includes(path)) {
    return path;
  }
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash && (VALID_TABS as readonly string[]).includes(hash)) {
    return hash;
  }
  return "dashboard";
};

/** `/nodes/<id>` deep-links to a node's detail page */
const getNodeIdFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/nodes\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
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
  // Keep the id only: the node itself is read from live data so the page tracks updates
  const [detailNodeId, setDetailNodeId] = useState<string | null>(() => getNodeIdFromUrl());
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const handleSelectTab = useCallback((tab: string) => {
    setCurrentTab(tab);
    setDetailNodeId(null);
    const targetPath = tab === "dashboard" ? "/" : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, "", targetPath);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(getTabFromUrl());
      setDetailNodeId(getNodeIdFromUrl());
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
    addSubscription,
    updateSubscription,
    deleteSubscription,
    totalUplinkSpeed: totalUpSpeed,
    totalDownlinkSpeed: totalDownSpeed,
    totalTrafficUsed,
    totalTrafficLimit,
    onlineNodesCount,
  } = useData(isAuthenticated, token);
  const openNode = useCallback((node: NodeItem) => {
    setCurrentTab("nodes");
    setDetailNodeId(node.id);
    const targetPath = `/nodes/${encodeURIComponent(node.id)}`;
    if (window.location.pathname !== targetPath) window.history.pushState({ tab: "nodes" }, "", targetPath);
    window.scrollTo({ top: 0 });
  }, []);
  const detailNode = detailNodeId ? nodes.find((n) => n.id === detailNodeId) ?? null : null;

  // Tab switch GSAP transition
  useGSAP(() => {
    if (!mainContentRef.current) return;
    gsap.fromTo(
      mainContentRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", clearProps: "transform,translate,scale,opacity" }
    );
  }, { dependencies: [currentTab] });

  // ⌘K / Ctrl+K opens the quick switcher anywhere in the console
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          onOpenSearch={() => setIsPaletteOpen(true)}
        />

        <main className="flex-1 px-4 py-5 sm:px-8 sm:py-7 max-w-[1400px] w-full space-y-4 sm:space-y-6">
          <div ref={mainContentRef}>
            <Suspense fallback={<PageSkeleton />}>
            {currentTab === "dashboard" && (
              <div className="space-y-6">
                <OverviewCards
                  nodes={nodes}
                  onSelectNode={openNode}
                  onSelectTab={handleSelectTab}
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
                  onSelectNode={openNode}
                />
              </div>
            )}

            {currentTab === "nodes" && detailNodeId && (
              detailNode ? (
                <NodeDetailPage
                  key={detailNode.id}
                  node={detailNode}
                  nodes={nodes}
                  relays={relays}
                  onBack={() => handleSelectTab("nodes")}
                  onOpenNode={openNode}
                  onUpdate={updateNode}
                  onSelectTab={handleSelectTab}
                />
              ) : loading && nodes.length === 0 ? (
                <PageSkeleton />
              ) : (
                <div className="p-12 rounded-xl border border-dashed border-rule text-center space-y-3">
                  <p className="text-sm text-ink-secondary">找不到这个节点，它可能已被删除。</p>
                  <button type="button" onClick={() => handleSelectTab("nodes")} className="text-sm text-accent hover:underline cursor-pointer">
                    返回节点列表
                  </button>
                </div>
              )
            )}

            {currentTab === "nodes" && !detailNodeId && (
              <NodeList
                nodes={nodes}
                onResetTraffic={resetTraffic}
                onDelete={deleteNode}
                onUpdate={updateNode}
                onRefreshData={fetchData}
                onOpenNode={openNode}
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
                onOpenNodeDetail={openNode}
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
                onAddSubscription={addSubscription}
                onUpdateSubscription={updateSubscription}
                onDeleteSubscription={deleteSubscription}
              />
            )}

            {currentTab === "script" && <ScriptView nodes={nodes} onAddNode={() => setIsAddNodeOpen(true)} />}

            {currentTab === "notifications" && (
              <TelegramNotificationView nodes={nodes} />
            )}
            </Suspense>
          </div>
        </main>

      </div>

      {/* Global Add Node Modal */}
      <NodeForm
        isOpen={isAddNodeOpen}
        onClose={() => setIsAddNodeOpen(false)}
        onSubmit={addNode}
      />

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        nodes={nodes}
        onSelectTab={handleSelectTab}
        onOpenNode={openNode}
      />

      {/* Global Unified Tooltip Portal & Native Title Interceptor */}
      <GlobalTooltip />

      {/* PWA Status and Install Banner */}
      <PWAStatusBanner />
    </div>
  );
}

export default App;
