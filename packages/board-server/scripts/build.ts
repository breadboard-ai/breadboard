/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  external: ["@google-cloud", "import.meta", "vite"],
  format: "esm",
  outfile: "dist/server/index.js",
});
