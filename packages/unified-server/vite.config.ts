/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { loadEnv, defineConfig, UserConfig } from "vite";
import { configureAssets } from "@breadboard-ai/visual-editor/vite";

export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  config();

  const envConfig = { ...loadEnv(mode!, process.cwd()) };

  const define = await configureAssets(__dirname, envConfig);

  return {
    optimizeDeps: { esbuildOptions: { target: "esnext" } },
    build: {
      target: "esnext",
      outDir: "dist/client",
      lib: {
        entry: {
          index: "./index.html",
          oauth: "./oauth/index.html",
        },
        formats: ["es"],
      },
    },
    define,
    resolve: {
      dedupe: ["lit"],
    },
  };
});
