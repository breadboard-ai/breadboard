/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, UserConfig } from "vite";

export default defineConfig(async (env): Promise<UserConfig> => {
  const define = { SKIP_DEBUG: env.mode !== "development" };

  const entry: Record<string, string> = {
    index: "./index.html",
  };

  return {
    optimizeDeps: { esbuildOptions: { target: "esnext" } },
    build: {
      target: "esnext",
      outDir: "dist/client",
      lib: {
        entry,
        formats: ["es"],
      },
    },
    define,
    resolve: {
      dedupe: ["lit"],
    },
    plugins: [],
    server: {},
  } satisfies UserConfig;
});
