/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { UserConfig } from "vite";
import * as Middleware from "./middleware/index.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async () => {
  config();

  const entry: Record<string, string> = {
    inspector: resolve(__dirname, "index.html"),
  };

  return {
    plugins: [
      Middleware.FileFallbackMiddleware.plugin({
        image: "public/sample.png",
        audio: "public/sample.wav",
        video: "public/sample.mp4",
      }),
    ],
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
