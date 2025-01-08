/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export const buildCustomAllowList = (value?: string) => {
  if (!value) return {};
  return { fs: { allow: [value] } };
};

export default defineConfig(async ({ mode }) => {
  config();

  const envConfig = { ...loadEnv(mode, process.cwd()) };
  if (!envConfig.VITE_LANGUAGE_PACK) {
    throw new Error("Language Pack not specified");
  }

  const languagePackUrl = await import.meta.resolve(
    envConfig.VITE_LANGUAGE_PACK
  );

  let languagePack;
  try {
    languagePack = (await import(languagePackUrl)).default;
  } catch (err) {
    throw new Error("Unable to import language pack");
  }

  return {
    build: {
      lib: {
        entry: {
          worker: "src/worker.ts",
          sample: "./index.html",
          oauth: "./oauth/index.html",
          bbrt: "./experimental/bbrt/index.html",
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
    define: {
      LANGUAGE_PACK: JSON.stringify(languagePack),
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
