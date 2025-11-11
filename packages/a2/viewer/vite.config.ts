/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { UserConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async () => {
  config();

  const entry: Record<string, string> = {
    inspector: resolve(__dirname, "index.html"),
  };

  return {
    plugins: [],
    build: {
      rollupOptions: {
        input: entry,
      },
      target: "esnext",
    },
    define: {},
    resolve: {
      dedupe: ["lit"],
    },
  } satisfies UserConfig;
};
