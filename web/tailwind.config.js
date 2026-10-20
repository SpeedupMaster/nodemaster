/**
 * Theme colors live in CSS variables (oklch, see src/styles/tokens.css). Tailwind v3 can't apply
 * opacity modifiers (`bg-paper/70`, `border-accent/30`) to plain var() colors and silently drops
 * those classes, so each token is wrapped to emit `color-mix()` when an alpha is requested.
 */
const token = (name) => ({ opacityValue }) =>
  opacityValue === undefined || opacityValue === "1"
    ? `var(${name})`
    : `color-mix(in oklch, var(${name}) calc(${opacityValue} * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      spacing: {
        0.2: "1px",
        4.5: "1.125rem",
      },
      colors: {
        paper: {
          DEFAULT: token("--color-paper"),
          2: token("--color-paper-2"),
          3: token("--color-paper-3"),
          hover: token("--color-paper-hover"),
          active: token("--color-paper-active"),
        },
        rule: {
          DEFAULT: token("--color-rule"),
          subtle: token("--color-rule-subtle"),
          active: token("--color-rule-active"),
        },
        ink: {
          DEFAULT: token("--color-ink"),
          secondary: token("--color-ink-secondary"),
          neutral: token("--color-neutral"),
          muted: token("--color-muted"),
        },
        accent: {
          DEFAULT: token("--color-accent"),
          subtle: token("--color-accent-subtle"),
          hover: token("--color-accent-hover"),
          focus: token("--color-focus"),
        },
        status: {
          online: token("--color-status-online"),
          "online-bg": token("--color-status-online-bg"),
          warning: token("--color-status-warning"),
          "warning-bg": token("--color-status-warning-bg"),
          danger: token("--color-status-danger"),
          "danger-bg": token("--color-status-danger-bg"),
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        pop: "var(--shadow-pop)",
        glow: "var(--shadow-glow)",
      },
      backgroundImage: {
        "gradient-brand": "var(--gradient-brand)",
        "gradient-accent": "var(--gradient-accent)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out-expo)",
        spring: "var(--ease-spring)",
      },
      // Keyframes animate the individual `translate` / `scale` properties so they
      // compose with Tailwind transform utilities (e.g. -translate-x-1/2) instead of overriding them.
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", translate: "0 6px" },
          to: { opacity: "1", translate: "0 0" },
        },
        "scale-up": {
          from: { opacity: "0", scale: "0.95" },
          to: { opacity: "1", scale: "1" },
        },
        "pop-in": {
          from: { opacity: "0", scale: "0.96", translate: "0 -4px" },
          to: { opacity: "1", scale: "1", translate: "0 0" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "pulse-ring": {
          "0%": { opacity: "0.55", scale: "1" },
          "100%": { opacity: "0", scale: "1.6" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        float: {
          "0%, 100%": { translate: "0 0" },
          "50%": { translate: "0 -4px" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms var(--ease-out-expo) both",
        fadeIn: "fade-up 220ms var(--ease-out-expo) both",
        "fade-up": "fade-up 320ms var(--ease-out-expo) both",
        "scale-up": "scale-up 240ms var(--ease-out-expo) both",
        scaleUp: "scale-up 240ms var(--ease-out-expo) both",
        "pop-in": "pop-in 180ms var(--ease-out-expo) both",
        shimmer: "shimmer 1.8s linear infinite",
        "pulse-ring": "pulse-ring 1.8s var(--ease-out-expo) infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
}
