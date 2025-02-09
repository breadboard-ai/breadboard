/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { loadEnv, UserConfig } from "vite";
import { configureAssets } from "./src/configure-assets";

export const buildCustomAllowList = (value?: string) => {
  if (!value) return {};
  return { fs: { allow: [value] } };
};

export default async ({ mode }: UserConfig) => {
  config();

  const envConfig = { ...loadEnv(mode!, process.cwd()) };

  const define = await configureAssets(__dirname, envConfig);

  const entry: Record<string, string> = {
    worker: "src/worker.ts",
    sample: "./index.html",
    oauth: "./oauth/index.html",
    bbrt: "./experimental/bbrt/index.html",
  };

  if (mode === "development") {
    entry["language"] = "./language.html";
  }

  return {
    build: {
      lib: {
        entry,
        name: "Breadboard Web Runtime",
        formats: ["es"],
      },
      target: "esnext",
    },
    define,
    server: {
      ...buildCustomAllowList(process.env.VITE_FS_ALLOW),
    },
    test: {
      include: ["tests/**/*.ts"],
    },
    optimizeDeps: {
      exclude: [
        // @breadboard-ai/python-wasm has dependency on pyodide (which is the
        // Python WASM runtime), but it's not compatible with Vite
        // optimizations.
        "pyodide",
      ],
    },
    resolve: {
      dedupe: ["lit"],
    },
  };
};
