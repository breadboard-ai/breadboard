/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export const buildCustomAllowList = (value?: string) => {
  if (!value) return {};
  return { fs: { allow: [value] } };
};

export default defineConfig((_) => {
  config();
  return {
    build: {
      lib: {
        entry: {
          worker: "src/worker.ts",
          sample: "./index.html",
          oauth: "./oauth/index.html",
          iframe: "./iframe.html",
          embed: "src/embed.ts",
          "palm-kit": "src/palm-kit.ts",
          "core-kit": "src/core-kit.ts",
          "json-kit": "src/json-kit.ts",
          "template-kit": "src/template-kit.ts",
          "python-wasm-kit": "src/python-wasm-kit.ts",
          "node-nursery-web-kit": "src/node-nursery-web-kit.ts",
        },
        name: "Breadboard Web Runtime",
        formats: ["es"],
      },
      target: "esnext",
    },
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
});
