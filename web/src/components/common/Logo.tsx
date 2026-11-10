import React from "react";

interface LogoProps {
  /** Rendered edge length in px */
  size?: number;
  /** Show the soft breathing halo behind the mark */
  animated?: boolean;
  className?: string;
}

/**
 * NodeMaster brand mark — same gradient and glyph as /favicon.svg and the PWA icons,
 * with a glass sheen and optional animated halo for in-app use.
 */
export const Logo: React.FC<LogoProps> = ({ size = 32, animated = false, className = "" }) => {

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {animated && (
        <>
          <span className="absolute inset-0 rounded-[28%] bg-accent/40 blur-md animate-pulse-soft" />
          <span className="absolute inset-0 rounded-[28%] border border-accent/50 animate-pulse-ring" />
        </>
      )}
      <svg viewBox="0 0 256 256" width={size} height={size} className="relative">
        <rect width="256" height="256" rx="60" fill="var(--color-accent-fill)" />
        <g transform="translate(128, 128) scale(0.66) translate(-128, -128)">
          <path
            d="M212,200a36,36,0,1,1-69.85-12.25l-53-34.05a36,36,0,1,1,0-51.4l53-34a36.09,36.09,0,1,1,8.67,13.45l-53,34.05a36,36,0,0,1,0,24.5l53,34.05A36,36,0,0,1,212,200Z"
            fill="#ffffff"
          />
        </g>
      </svg>
    </span>
  );
};
