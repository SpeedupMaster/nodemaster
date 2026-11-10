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
    online: "bg-status-online/10 text-status-online dark:text-status-online border-status-online/25 dark:border-status-online/30",
    warning: "bg-status-warning/10 text-status-warning dark:text-status-warning border-status-warning/25 dark:border-status-warning/30",
    danger: "bg-status-danger/10 text-status-danger dark:text-status-danger border-status-danger/25 dark:border-status-danger/30",
    neutral: "bg-paper-3 text-ink-secondary border-rule",
    accent: "bg-accent/10 text-accent border-accent/25 dark:border-accent/30",
    unlock: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/25 dark:border-purple-500/30",
    probe: "bg-accent/10 text-accent dark:text-accent border-accent/25 dark:border-accent/30",
  }[variant];

  const dotColors = {
    online: "bg-status-online dark:bg-status-online",
    warning: "bg-status-warning dark:bg-status-warning",
    danger: "bg-status-danger dark:bg-status-danger",
    neutral: "bg-ink-muted",
    accent: "bg-accent",
    unlock: "bg-purple-500 dark:bg-purple-400",
    probe: "bg-accent-fill dark:bg-accent",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border whitespace-nowrap shrink-0 select-none ${sizeClasses} ${variantStyles} ${className}`}
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
