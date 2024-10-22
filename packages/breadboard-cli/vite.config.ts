import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { dirname, join } from "path";

// Carry through the visual-editor public dir as the public dir for the
// debugger here. It's essentially a passthrough.
let breadboardWebPublic: boolean | string = false;
// @ts-expect-error 2274
if (import.meta.resolve) {
  const publicPath = import.meta.resolve("@breadboard-ai/visual-editor/public");
  breadboardWebPublic = fileURLToPath(publicPath);
} else {
  const require = createRequire(import.meta.url);
  const breadboardWebIndex = require.resolve("@breadboard-ai/visual-editor");
  breadboardWebPublic = join(dirname(breadboardWebIndex), "..", "public");
}

export default defineConfig({
  optimizeDeps: {
    include: [
      "@breadboard-ai/visual-editor",
      "@google-labs/breadboard",
      "@google-labs/core-kit",
      "@google-labs/template-kit",
      "commander",
      "esbuild",
      "serve",
      "vite",
      "yaml",
    ],
  },
  build: {
    lib: {
      entry: {
        index: "./index.html",
      },
      name: "Breadboard Debugger Runtime",
      formats: ["es"],
    },
    outDir: "../../dist/debugger",
    target: "esnext",
  },
  root: "src/debugger",
  publicDir: breadboardWebPublic,
});
