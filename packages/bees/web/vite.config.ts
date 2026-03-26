import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        iframe: resolve(__dirname, "iframe.html"),
      },
    },
  },
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
