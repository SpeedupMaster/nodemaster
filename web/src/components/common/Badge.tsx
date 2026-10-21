import React from "react";

interface BadgeProps {
  variant?: "online" | "warning" | "danger" | "neutral" | "accent" | "unlock" | "probe";
  children: React.ReactNode;
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  children,
  pulse = false,
  size = "sm",
  className = "",
}) => {
  const sizeClasses = size === "sm" ? "text-[10px] px-2 py-0.5 leading-none" : "text-xs px-2.5 py-1 leading-none";

  const variantStyles = {
    online: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    neutral: "bg-paper-3 text-ink-secondary border-rule",
    accent: "bg-accent/10 text-accent border-accent/30",
    unlock: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    probe: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  }[variant];

  const dotColors = {
    online: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    neutral: "bg-ink-muted",
    accent: "bg-accent",
    unlock: "bg-purple-400",
    probe: "bg-sky-400",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-full border whitespace-nowrap shrink-0 select-none ${sizeClasses} ${variantStyles} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors}`}
          />
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColors}`}
          />
        </span>
      )}
      <span>{children}</span>
    </span>
  );
};
