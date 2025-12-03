/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { configureAssets } from "./src/configure-assets.js";
import { tryGetGitHash } from "./src/build-info.js";
import { defineConfig, loadEnv, UserConfig } from "vite";
import compression from "vite-plugin-compression2";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  const envConfig = { ...loadEnv(mode!, __dirname) };

  const [definedAssets, buildInfo] = await Promise.all([
    configureAssets(__dirname, envConfig),
    tryGetGitHash(),
  ]);

  const define = { ...buildInfo, ...definedAssets };

  const entry: Record<string, string> = {
    index: "./index.html",
    oauth: "./oauth/index.html",
    landing: "./landing/index.html",
    shell: "./shell/index.html",
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
    plugins: [
      compression({
        include: /\.(js|json|css|html|wasm|svg|woff2)$/,
        algorithms: ["brotliCompress"],
        threshold: 1024,
        deleteOriginalAssets: false,
      }),
    ],
    server: {
      watch: {
        ignored: [
          "**/shared-ui/src/bgl/**",
          "**/.wireit/**",
          "**/*.kit.json/**",
        ],
      },
    },
  } satisfies UserConfig;
});
