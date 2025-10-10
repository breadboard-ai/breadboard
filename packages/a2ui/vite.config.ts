/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { UserConfig } from "vite";
import * as A2UI from "./src";

export default async () => {
  config();

  const entry: Record<string, string> = {
    index: "./index.html",
  };
  return {
    plugins: [
      A2UI.v0_8.Middleware.GeminiMiddleware.plugin(),
      A2UI.v0_8.Middleware.ImageFallbackMiddleware.plugin(
        "public/sample/scenic_view.jpg"
      ),
    ],
    build: {
      lib: {
        entry,
        name: "A2UI Editor",
        formats: ["es"],
      },
      target: "esnext",
    },
    define: {},
    resolve: {
      dedupe: ["lit"],
    },
  } satisfies UserConfig;
};
