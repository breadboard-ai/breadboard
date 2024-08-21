/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { copyFile } from "fs/promises";
import { dirname, join } from "path";

const pyodideDir = dirname(
  new URL(import.meta.resolve("pyodide/package.json")).pathname
);

await Promise.all(
  [
    "python_stdlib.zip",
    "pyodide.asm.wasm",
    "pyodide.asm.js",
    "pyodide-lock.json",
  ].map((filename) =>
    copyFile(
      decodeURI(join(pyodideDir, filename)),
      decodeURI(join(import.meta.dirname, "..", "public", filename))
    )
  )
);
