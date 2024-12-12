/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
        oauth: "./oauth/index.html",
        editor: "./experimental/editor.html",
      },
      formats: ["es"],
    },
  },
  resolve: {
    dedupe: ["lit"],
  },
});
