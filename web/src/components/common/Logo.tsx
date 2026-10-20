import React, { useId } from "react";

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
  const uid = useId().replace(/:/g, "");
  const bgId = `nm-logo-bg-${uid}`;
  const sheenId = `nm-logo-sheen-${uid}`;

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
      <svg viewBox="0 0 256 256" width={size} height={size} className="relative drop-shadow-[0_4px_10px_rgba(37,99,235,0.35)]">
        <defs>
          <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id={sheenId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="256" height="256" rx="64" fill={`url(#${bgId})`} />
        <rect width="256" height="256" rx="64" fill={`url(#${sheenId})`} />
        <rect x="1.5" y="1.5" width="253" height="253" rx="62.5" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" />
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
