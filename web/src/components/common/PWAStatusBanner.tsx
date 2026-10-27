import React from "react";
import { DownloadSimple, ArrowClockwise, WifiSlash } from "@phosphor-icons/react";
import { usePWA } from "../../hooks/usePWA";

export const PWAStatusBanner: React.FC = () => {
  const { isOffline, needRefresh, updateServiceWorker } = usePWA();

  return (
    <>
      {/* 1. Offline Mode Indicator */}
      {isOffline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-950/90 border border-amber-600/40 text-amber-200 text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom duration-200 pointer-events-auto select-none"
        >
          <WifiSlash weight="bold" className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>网络已离线，当前显示本地缓存视图</span>
        </aside>
      )}

      {/* 2. New Version Update Prompt */}
      {needRefresh && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-xl bg-paper-2/95 border border-accent/40 text-ink text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top duration-200 pointer-events-auto select-none"
        >
          <div className="flex items-center gap-1.5 text-accent font-medium">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span>发现控制台新版本</span>
          </div>
          <button
            type="button"
            onClick={updateServiceWorker}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors cursor-pointer text-xs"
          >
            <ArrowClockwise weight="bold" className="w-3.5 h-3.5" />
            <span>立即更新</span>
          </button>
        </aside>
      )}
    </>
  );
};

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { isInstallable, installPWA } = usePWA();

  if (!isInstallable) return null;

  return (
    <button
      type="button"
      onClick={installPWA}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-xs font-medium transition-colors cursor-pointer ${className}`}
      title="将 NodeMaster 安装至桌面或主屏幕"
    >
      <DownloadSimple weight="bold" className="w-3.5 h-3.5" />
      <span>安装应用</span>
    </button>
  );
};
