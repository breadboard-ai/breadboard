/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { configureAssets } from "@breadboard-ai/visual-editor/vite";
import { tryGetGitHash } from "@breadboard-ai/visual-editor/build-info";
import { config } from "dotenv";
import { defineConfig, loadEnv, UserConfig } from "vite";
import compression from "vite-plugin-compression2";

export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  config();

  const envConfig = { ...loadEnv(mode!, process.cwd()) };

  const [definedAssets, buildInfo] = await Promise.all([
    configureAssets(__dirname, envConfig),
    tryGetGitHash(),
  ]);

  const define = { ...buildInfo, ...definedAssets };

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
    plugins: [
      compression({
        include: /\.(js|json|css|html|wasm|svg|woff2)$/,
        algorithm: "brotliCompress",
        threshold: 1024,
        deleteOriginalAssets: false,
      }),
    ],
    server: {
      watch: {
        ignored: ["**/shared-ui/src/bgl/**"],
      },
    },
  };
});
