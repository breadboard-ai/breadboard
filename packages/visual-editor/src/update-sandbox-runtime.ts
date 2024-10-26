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

async function copy(filename: string, destination: string[]) {
  const fullPath = join(jsandboxDir, filename);
  // Since JSandbox is still under construction,
  // make this operation fail silently with a warning, rather than break the
  // build.
  if (!existsSync(fullPath)) {
    console.warn(`WARNING: JSandbox bits weren't found at:\n${fullPath}`);
    exit(0);
  }
  const source = decodeURI(join(jsandboxDir, filename));
  const dest = decodeURI(join(import.meta.dirname, "..", ...destination));
  console.log(`Copying\nfrom: "${source}"\nto: "${dest}"`);
  await copyFile(source, dest);
}

// First, copy the import to the src
await Promise.all([
  copy("jsandbox_bg.js", ["src", "sandbox", "bindings.js"]),
  copy("jsandbox_bg.wasm", ["public", "sandbox.wasm"]),
]);
