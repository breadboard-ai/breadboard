/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  configureAssets,
  policyContent,
} from "@breadboard-ai/visual-editor/vite";
import { tryGetGitHash } from "@breadboard-ai/visual-editor/build-info";
import { config } from "dotenv";
import { defineConfig, loadEnv, UserConfig } from "vite";
import compression from "vite-plugin-compression2";
import tsconfigRaw from "./tsconfig.client.json" with { type: "json" };

export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  config();

  const envConfig = { ...loadEnv(mode!, process.cwd()) };

  const [definedAssets, buildInfo] = await Promise.all([
    configureAssets(__dirname, envConfig),
    tryGetGitHash(),
  ]);

  const define = { ...buildInfo, ...definedAssets };

  const entry: Record<string, string> = {
    index: "./index.html",
    oauth: "./oauth/index.html",
    landing: "./landing/index.html",
  };

  if (define.ENABLE_POLICY) {
    entry["policy"] = "./policy/index.html";
  }

  return {
    esbuild: {
      tsconfigRaw,
    },
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
        algorithm: "brotliCompress",
        threshold: 1024,
        deleteOriginalAssets: false,
      }),
      policyContent(
        "/policy/",
        define.POLICY_HTML ? JSON.parse(define.POLICY_HTML) : undefined
      ),
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
