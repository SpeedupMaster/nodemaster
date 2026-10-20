import React from "react";
import ReactDOM from "react-dom/client";
import gsap from "gsap";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import { initAuthInterceptor } from "./services/api";
import "./styles/globals.css";

initAuthInterceptor();

// Honour the OS reduced-motion setting for GSAP tweens (CSS animations are handled in globals.css)
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.globalTimeline.timeScale(20);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

