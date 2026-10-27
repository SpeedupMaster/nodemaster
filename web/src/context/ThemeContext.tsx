import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "nodemaster-theme";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch (e) {
    // ignore
  }
  return "system";
}

function triggerColorTransition() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  window.setTimeout(() => {
    root.classList.remove("theme-transitioning");
  }, 400);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  // Listen for system color scheme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // Apply to document.documentElement and meta tags
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }

    // Update meta theme-color for mobile chrome & Safari PWA
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", resolvedTheme === "dark" ? "#101522" : "#f8fafc");
    }
  }, [resolvedTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    const doc = document as any;
    if (
      typeof doc !== "undefined" &&
      typeof doc.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      doc.startViewTransition(() => {
        setThemeState(newTheme);
        try {
          localStorage.setItem(STORAGE_KEY, newTheme);
        } catch (e) {
          // ignore
        }
      });
      return;
    }

    triggerColorTransition();
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextResolved: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";
    const nextTheme: Theme = nextResolved;

    // View Transitions API with quiet, ambient cross-dissolve (Apple/Linear style)
    const doc = document as any;
    if (
      typeof doc !== "undefined" &&
      typeof doc.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      doc.startViewTransition(() => {
        setThemeState(nextTheme);
        try {
          localStorage.setItem(STORAGE_KEY, nextTheme);
        } catch (e) {
          // ignore
        }
      });
      return;
    }

    // Fallback: smooth CSS color transition
    triggerColorTransition();
    setThemeState(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (e) {
      // ignore
    }
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
