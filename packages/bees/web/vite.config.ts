import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/tickets": "http://localhost:3200",
      "/playbooks": "http://localhost:3200",
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
});
