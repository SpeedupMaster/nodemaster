import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefixIcon?: React.ReactNode;
  prefixText?: string;
  suffixText?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  prefixIcon,
  prefixText,
  suffixText,
  error,
  className = "",
  type = "text",
  ...props
}) => {
  return (
    <div className="relative w-full">
      <div
        className={`w-full flex items-center rounded-md bg-paper border transition-all ${
          error
            ? "border-status-danger ring-1 ring-status-danger/20"
            : "border-rule hover:border-rule-active focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30"
        } ${props.disabled ? "opacity-50 cursor-not-allowed bg-paper-3" : ""}`}
      >
        {prefixIcon && (
          <div className="pl-3 text-ink-muted flex items-center justify-center flex-shrink-0">
            {prefixIcon}
          </div>
        )}

        {prefixText && (
          <div className="pl-3 text-xs font-mono font-medium text-ink-secondary select-none flex-shrink-0">
            {prefixText}
          </div>
        )}

        <input
          type={type}
          className={`w-full bg-transparent px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            type === "date" ? "[color-scheme:dark]" : ""
          } ${className}`}
          {...props}
        />

        {suffixText && (
          <div className="pr-3 text-xs font-mono text-ink-muted select-none flex-shrink-0">
            {suffixText}
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-status-danger mt-1 font-mono">{error}</p>
      )}
    </div>
  );
};
