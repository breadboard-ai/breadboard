/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from "vite";
import { tokenPlugin } from "./scripts/tokens-plugin.js";

export default defineConfig({
  publicDir: "./frontend/public",
  plugins: [tokenPlugin()],
  server: {
    proxy: {
      "/folio": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
