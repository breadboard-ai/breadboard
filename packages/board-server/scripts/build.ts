/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as esbuild from "esbuild";

await Promise.all([
  esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    external: ["@google-cloud", "import.meta", "vite", "better-sqlite3"],
    format: "esm",
    outfile: "dist/server/index.js",
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ["src/router.ts"],
    bundle: true,
    platform: "node",
    external: ["@google-cloud", "import.meta", "vite", "better-sqlite3"],
    format: "esm",
    outfile: "dist/server/router.js",
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ["scripts/create-account.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: "dist/scripts/create-account.js",
    sourcemap: true,
    external: ["@google-cloud", "import.meta", "vite", "better-sqlite3"],
  }),
]);
