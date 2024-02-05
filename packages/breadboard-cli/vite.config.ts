import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { dirname, join } from "path";

// Carry through the breadboard-web public dir as the public dir for the
// debugger here. It's essentially a passthrough.
let breadboardWebPublic: boolean | string = false;
if (import.meta.resolve) {
  const publicPath = await import.meta.resolve(
    "@google-labs/breadboard-web/public"
  );
  breadboardWebPublic = fileURLToPath(publicPath);
} else {
  const require = createRequire(import.meta.url);
  const breadboardWebIndex = require.resolve("@google-labs/breadboard-web");
  breadboardWebPublic = join(dirname(breadboardWebIndex), "..", "public");
}

export default defineConfig({
  build: {
    lib: {
      entry: {
        // TODO: These are just variants of the breadboard-web entry points; we
        // could (and possibly should) unify them.
        index: "./index.html",
        preview: "./preview.html",
        worker: "./worker.ts",
        boards: "./boards.ts",
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
