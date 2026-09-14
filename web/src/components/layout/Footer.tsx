import React from "react";

/* Hallmark · footer: Ft2 Inline single line */
export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-rule py-4 px-6 bg-paper/40 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-muted gap-2 font-mono select-none">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-ink">NodeMaster</span>
        <span>—</span>
        <span>多 VPS 节点管理与智能分流控制面板</span>
      </div>

      <div className="flex items-center gap-4 text-[11px]">
        <span>Xray-core v1.8+</span>
        <span>•</span>
        <span>Clash Meta / Mihomo 自适应</span>
        <span>•</span>
        <span>Hallmark Modern-Minimal</span>
      </div>
    </footer>
  );
};
