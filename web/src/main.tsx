import React from "react";
import ReactDOM from "react-dom/client";
import gsap from "gsap";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "harmonyos-sans-sc-webfont-splitted/dist/Regular.css";
import "harmonyos-sans-sc-webfont-splitted/dist/Medium.css";
import "harmonyos-sans-sc-webfont-splitted/dist/Bold.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./styles/globals.css";

// Honour the OS reduced-motion setting for GSAP tweens (CSS animations are handled in globals.css)
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.globalTimeline.timeScale(20);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
