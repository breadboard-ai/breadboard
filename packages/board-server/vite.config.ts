import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
  build: { target: "esnext", outDir: "./dist/client" },
});
