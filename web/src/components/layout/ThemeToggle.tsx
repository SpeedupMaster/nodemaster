import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Desktop, Check } from "@phosphor-icons/react";
import { useTheme, Theme } from "../../context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      label: "浅色模式",
      icon: <Sun weight="duotone" className="w-4 h-4 text-amber-500" />,
    },
    {
      value: "dark",
      label: "深色模式",
      icon: <Moon weight="duotone" className="w-4 h-4 text-sky-400" />,
    },
    {
      value: "system",
      label: "跟随系统",
      icon: <Desktop weight="duotone" className="w-4 h-4 text-ink-muted" />,
    },
  ];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={menuRef}>
      {/* Pure Icon Button (Exact 38x38px, quiet ambient cross-dissolve) */}
      <button
        type="button"
        onClick={() => toggleTheme()}
        onContextMenu={handleContextMenu}
        title={`切换主题（当前：${resolvedTheme === "dark" ? "深色" : "浅色"}${theme === "system" ? " · 跟随系统" : ""}，右键更多选项）`}
        aria-label="切换浅色或深色主题"
        className="w-[38px] h-[38px] rounded-lg bg-paper-2 hover:bg-paper-hover active:bg-paper-active border border-rule hover:border-rule-active transition-all duration-150 active:scale-[0.97] shadow-xs flex items-center justify-center text-ink cursor-pointer shrink-0 touch-manipulation overflow-hidden"
      >
        <div className="relative w-4 h-4 flex items-center justify-center pointer-events-none select-none">
          {/* Sun icon: calm, quiet fade with subtle scale */}
          <Sun
            weight="duotone"
            className={`w-4.5 h-4.5 text-amber-500 absolute inset-0 m-auto transition-all duration-300 ease-out ${
              resolvedTheme === "dark"
                ? "opacity-0 scale-75 translate-y-0.5"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          />
          {/* Moon icon: calm, quiet fade with subtle scale */}
          <Moon
            weight="duotone"
            className={`w-4.5 h-4.5 text-sky-400 absolute inset-0 m-auto transition-all duration-300 ease-out ${
              resolvedTheme === "dark"
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-75 -translate-y-0.5"
            }`}
          />
        </div>
      </button>

      {/* Context dropdown menu (Right-click or triggered) */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-36 rounded-xl bg-paper-2 border border-rule shadow-pop py-1 z-50 animate-in fade-in zoom-in">
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-ink-muted">
            主题外观
          </div>
          {options.map((opt) => {
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTheme(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-ink-secondary hover:text-ink hover:bg-paper-hover"
                }`}
              >
                <div className="flex items-center gap-2">
                  {opt.icon}
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check weight="bold" className="w-3.5 h-3.5 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
