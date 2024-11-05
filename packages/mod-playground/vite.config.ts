/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

export default defineConfig((_) => {
  config();
  return {
    build: {
      lib: {
        entry: {
          main: "./index.html",
        },
        name: "Breadboard Module Playground",
        formats: ["es"],
      },
      target: "esnext",
    },
    resolve: {
      dedupe: ["lit"],
    },
  };
});
