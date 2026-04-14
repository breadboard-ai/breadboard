/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/folio": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
