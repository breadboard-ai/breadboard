/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, type UserConfig } from "vite";

export default defineConfig((): UserConfig => {
  return {
    optimizeDeps: { esbuildOptions: { target: "esnext" } },
    build: {
      target: "esnext",
      outDir: "dist/client",
    },
    resolve: {
      dedupe: ["lit"],
    },
    server: {
      port: 3333,
      watch: {
        ignored: ["**/.wireit/**"],
      },
    },
  };
});
