import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlass, ArrowElbowDownLeft, HardDrives } from "@phosphor-icons/react";
import type { NodeItem } from "../../types";
import { NAV_GROUPS } from "./Sidebar";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeItem[];
  onSelectTab: (tab: string) => void;
  onOpenNode: (node: NodeItem) => void;
}

type Entry =
  | { kind: "page"; id: string; label: string; group: string; icon: React.ElementType }
  | { kind: "node"; node: NodeItem };

const STATUS_DOT: Record<NodeItem["status"], string> = {
  online: "bg-status-online",
  offline: "bg-status-danger",
  circuit_broken: "bg-status-danger",
};

/** ⌘K / Ctrl+K quick switcher across pages and nodes */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, nodes, onSelectTab, onOpenNode }) => {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: Entry[] = NAV_GROUPS.flatMap((g) =>
      g.items.map((it) => ({ kind: "page" as const, id: it.id, label: it.label, group: g.label || "导航", icon: it.icon }))
    ).filter((p) => !q || (p.kind === "page" && p.label.toLowerCase().includes(q)));
    const nodeHits: Entry[] = nodes
      .filter((n) => !q || [n.name, n.ip, n.country, n.countryName, ...(n.tags || [])].some((v) => v?.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((node) => ({ kind: "node" as const, node }));
    return [...pages, ...nodeHits];
  }, [query, nodes]);

  useEffect(() => setCursor(0), [query]);

  if (!isOpen || typeof document === "undefined") return null;

  const run = (e: Entry | undefined) => {
    if (!e) return;
    if (e.kind === "page") onSelectTab(e.id);
    else onOpenNode(e.node);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(entries[cursor]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label="快速跳转">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-paper-2 border border-rule rounded-xl shadow-pop overflow-hidden animate-pop-in" onKeyDown={onKeyDown}>
        <label className="flex items-center gap-2.5 px-4 h-12 border-b border-rule">
          <MagnifyingGlass className="w-[18px] h-[18px] text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="跳转到页面，或搜索节点名称、IP、标签…"
            aria-label="搜索"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted"
          />
          <kbd className="font-mono text-[11px] text-ink-muted px-1.5 py-0.5 border border-rule rounded-[5px]">Esc</kbd>
        </label>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox" aria-label="结果">
          {entries.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-muted">没有匹配的页面或节点</li>}
          {entries.map((e, i) => {
            const active = i === cursor;
            const showHeader = i === 0 || entries[i - 1].kind !== e.kind;
            return (
              <React.Fragment key={e.kind === "page" ? `p-${e.id}` : `n-${e.node.id}`}>
                {showHeader && (
                  <li className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-ink-muted" role="presentation">
                    {e.kind === "page" ? "页面" : "节点"}
                  </li>
                )}
                <li
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => run(e)}
                  className={`flex items-center gap-3 h-10 px-2.5 rounded-lg cursor-pointer text-[13.5px] ${active ? "bg-paper-3 text-ink" : "text-ink-secondary"}`}
                >
                  {e.kind === "page" ? (
                    <>
                      <e.icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{e.label}</span>
                      <span className="text-xs text-ink-muted">{e.group}</span>
                    </>
                  ) : (
                    <>
                      <HardDrives className="w-4 h-4 shrink-0" />
                      <span className="font-mono text-[11px] text-ink-muted w-6">{e.node.country}</span>
                      <span className="flex-1 truncate">{e.node.name}</span>
                      <span className="font-mono text-xs text-ink-muted">{e.node.ip}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[e.node.status]}`} />
                    </>
                  )}
                  {active && <ArrowElbowDownLeft className="w-3.5 h-3.5 text-ink-muted" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body
  );
};
