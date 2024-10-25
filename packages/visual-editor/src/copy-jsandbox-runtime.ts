/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from "fs";
import { copyFile } from "fs/promises";
import { join } from "path";
import { exit } from "process";

// TODO: Actually make this a real dependency.
const jsandboxDir = join(
  import.meta.dirname,
  "..",
  "..",
  "jsandbox",
  "target",
  "wasm-bindgen"
);

await Promise.all(
  ["jsandbox_bg.js", "jsandbox_bg.wasm"].map((filename) => {
    const fullPath = join(jsandboxDir, filename);
    // Since JSandbox is still under construction,
    // make this operation fail silently with a warning, rather than break the
    // build.
    if (!existsSync(fullPath)) {
      console.warn(`WARNING: JSandbox bits weren't found at:\n${fullPath}`);
      exit(0);
    }
    copyFile(
      decodeURI(join(jsandboxDir, filename)),
      decodeURI(join(import.meta.dirname, "..", "jsandbox", filename))
    );
  })
);
