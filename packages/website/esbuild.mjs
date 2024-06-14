#!/usr/bin/env node

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as esbuild from "esbuild";

esbuild.build({
  entryPoints: ["src/js/board-embed.ts", "src/js/code-clipboard.ts"],
  bundle: true,
  target: ["esnext"],
  format: "esm",
  outdir: "dist/esbuild",
  platform: "browser",
  external: ["node:fs/promises", "node:vm"],
  minify: true,
});
