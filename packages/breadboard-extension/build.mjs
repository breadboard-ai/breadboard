/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as esbuild from "esbuild";
import { rimrafSync } from "rimraf";

rimrafSync("dist");

esbuild.build({
  entryPoints: ["./src/extension.ts"],
  platform: "node",
  outfile: "dist/extension.js",
  format: "cjs",
  target: "node18",
  bundle: true,
  minify: false,
  external: ["vscode"],
  // CJS does not support import.meta, and esbuild will complain about its usage
  // within the codebase. In the case of node/vscode, where we run as CommonJS,
  // we therefore have to ensure that we always provide a base URL so that
  // import.meta.url is never queried. To appease esbuild, however, we also set
  // import.meta.url as undefined here.
  define: {
    "import.meta.url": "undefined",
  },
});
