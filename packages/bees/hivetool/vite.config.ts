import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Use /breadboard/hivetool/ for production builds (GitHub Pages), / for dev.
  base: command === "build" ? "/breadboard/hivetool/" : "/",
  server: {
    port: 5174,
    proxy: {
      "/tickets": "http://localhost:3200",
      "/playbooks": "http://localhost:3200",
      "/status": "http://localhost:3200",
      "/events": {
        target: "http://localhost:3200",
        // SSE needs special handling.
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Accept", "text/event-stream");
          });
        },
      },
    },
  },
  build: {
    target: "esnext",
  },
}));
