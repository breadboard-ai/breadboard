import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
  build: {
    target: "esnext",
    outDir: "./dist/client",
    lib: {
      entry: {
        index: "./index.html",
        api: "./api.html",
      },
      formats: ["es"],
    },
  },
});
