import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "harmonyos-sans-sc-webfont-splitted/dist": path.resolve(__dirname, "./node_modules/harmonyos-sans-sc-webfont-splitted/dist"),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3880",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3880",
        ws: true,
      },
    },
  },
});
