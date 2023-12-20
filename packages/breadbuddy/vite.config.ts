/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: {
      entry: {
        buddy: "src/web/index.ts",
        index: "./index.html",
      },
      name: "Breadbuddy",
      formats: ["es"],
    },
    target: "esnext",
  },
  server: {},
  test: {
    include: ["tests/**/*.ts"],
  },
  plugins: [],
});
