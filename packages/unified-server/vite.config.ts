import { defineConfig, mergeConfig } from "vite";
import visualEditorConfigFn from "../visual-editor/vite.config.ts";

export default defineConfig(async (env) => {
  const visualEditorConfig = await visualEditorConfigFn(env);
  return mergeConfig(visualEditorConfig, {
    root: "../visual-editor",
    build: {
      outDir: "../unified-server/dist/client",
      emptyOutDir: true,
    },
  });
});
