/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "var(--color-paper)",
          2: "var(--color-paper-2)",
          3: "var(--color-paper-3)",
          hover: "var(--color-paper-hover)",
          active: "var(--color-paper-active)",
        },
        rule: {
          DEFAULT: "var(--color-rule)",
          subtle: "var(--color-rule-subtle)",
          active: "var(--color-rule-active)",
        },
        ink: {
          DEFAULT: "var(--color-ink)",
          secondary: "var(--color-ink-secondary)",
          neutral: "var(--color-neutral)",
          muted: "var(--color-muted)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          subtle: "var(--color-accent-subtle)",
          hover: "var(--color-accent-hover)",
          focus: "var(--color-focus)",
        },
        status: {
          online: "var(--color-status-online)",
          "online-bg": "var(--color-status-online-bg)",
          warning: "var(--color-status-warning)",
          "warning-bg": "var(--color-status-warning-bg)",
          danger: "var(--color-status-danger)",
          "danger-bg": "var(--color-status-danger-bg)",
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
    },
  },
  plugins: [],
}
