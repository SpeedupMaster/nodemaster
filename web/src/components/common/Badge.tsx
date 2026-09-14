import React from "react";

interface BadgeProps {
  variant?: "online" | "warning" | "danger" | "neutral" | "accent" | "transit" | "exit";
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
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  const variantStyles = {
    online: "bg-status-online-bg text-status-online border-status-online/30",
    warning: "bg-status-warning-bg text-status-warning border-status-warning/30",
    danger: "bg-status-danger-bg text-status-danger border-status-danger/30",
    neutral: "bg-paper-3 text-ink-secondary border-rule",
    accent: "bg-accent-subtle text-accent border-accent/30",
    transit: "bg-sky-950/40 text-sky-400 border-sky-500/30",
    exit: "bg-purple-950/40 text-purple-300 border-purple-500/30",
  }[variant];

  const dotColors = {
    online: "bg-status-online",
    warning: "bg-status-warning",
    danger: "bg-status-danger",
    neutral: "bg-ink-muted",
    accent: "bg-accent",
    transit: "bg-sky-400",
    exit: "bg-purple-400",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-full border ${sizeClasses} ${variantStyles} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${dotColors}`}
          />
        </span>
      )}
      {children}
    </span>
  );
};
