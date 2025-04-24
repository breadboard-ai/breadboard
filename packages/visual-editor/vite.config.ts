/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { HmrContext, loadEnv, Plugin, UserConfig } from "vite";
import { configureAssets } from "./src/configure-assets";
import { tryGetGitHash } from "./src/build-info";

function noHrmlForDir(dir: string): Plugin {
  return {
    name: "no-hmr-for-dir",
    handleHotUpdate: ({ modules }: HmrContext) => {
      return modules.filter((module) => !module.file?.includes(dir));
    },
  };
}

export const buildCustomAllowList = (value?: string) => {
  if (!value) return {};
  return { fs: { allow: [value] } };
};

export default async ({ mode }: UserConfig) => {
  config();

  const envConfig = { ...loadEnv(mode!, process.cwd()) };

  const [definedAssets, buildInfo] = await Promise.all([
    configureAssets(__dirname, envConfig),
    tryGetGitHash(),
  ]);

  const define = { ...buildInfo, ...definedAssets };

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
      watch: {
        ignored: ["**/.wireit/**", "**/*.kit.json/**"],
      },
    },
    plugins: [noHrmlForDir("packages/a2")],
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
  } satisfies UserConfig;
};
