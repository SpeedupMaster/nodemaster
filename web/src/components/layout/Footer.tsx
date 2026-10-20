import React from "react";
import { Logo } from "../common/Logo";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-rule-subtle py-4 px-4 sm:px-6 bg-paper-2/30 backdrop-blur-sm select-none">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-ink-muted font-mono">
        {/* Left: Brand & Description */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 text-ink font-semibold">
            <Logo size={16} />
            <span>NodeMaster</span>
          </div>
          <span className="hidden sm:inline text-ink-muted/50">—</span>
          <span className="text-[11px] sm:text-xs text-ink-secondary">
            多 VPS 节点管理与智能分流控制面板
          </span>
        </div>

        {/* Right: Technical specifications & badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-ink-muted">
          <span className="px-2 py-0.5 rounded bg-paper-3/80 border border-rule/70">
            Xray-core v26+
          </span>
          <span className="px-2 py-0.5 rounded bg-paper-3/80 border border-rule/70">
            Clash Meta / Mihomo
          </span>
          <span className="hidden sm:inline px-2 py-0.5 rounded bg-paper-3/80 border border-rule/70">
            Modern Minimal
          </span>
        </div>
      </div>
    </footer>
  );
};
