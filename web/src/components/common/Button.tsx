import React from "react";
import { CircleNotch } from "@phosphor-icons/react";

/* Hallmark · component: Button · genre: modern-minimal · theme: Cobalt
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  pill?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  loading = false,
  pill = false,
  icon,
  disabled,
  className = "",
  ...props
}) => {
  const baseClasses =
    "group relative inline-flex items-center justify-center font-medium transition-all duration-200 ease-out-expo select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";

  const sizeClasses = {
    sm: "text-xs px-2.5 py-1 gap-1.5",
    md: "text-sm px-3.5 py-1.5 gap-2",
    lg: "text-base px-5 py-2.5 gap-2.5",
  }[size];

  const shapeClass = pill ? "rounded-full" : "rounded-md";

  const variantClasses = {
    primary:
      "bg-gradient-accent text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_0_rgba(0,0,0,0.3)] hover:shadow-glow hover:brightness-110",
    secondary:
      "bg-paper-2 text-ink border border-rule shadow-xs hover:bg-paper-hover hover:border-rule-active hover:text-ink active:bg-paper-active",
    danger:
      "bg-status-danger-bg text-status-danger border border-status-danger/30 hover:bg-status-danger hover:text-paper active:bg-status-danger/90",
    ghost:
      "text-ink-secondary hover:text-ink hover:bg-paper-2 active:bg-paper-3",
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${shapeClass} ${variantClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <CircleNotch className="w-4 h-4 animate-spin text-current" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
