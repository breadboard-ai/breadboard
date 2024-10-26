/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from "fs";
import { copyFile } from "fs/promises";
import { join } from "path";
import { exit } from "process";

const targetDir = join(import.meta.dirname, "..", "target", "wasm-bindgen");

async function copy(filename: string, destination: string[]) {
  const fullPath = join(targetDir, filename);
  // Since JSandbox is still under construction,
  // make this operation fail silently with a warning, rather than break the
  // build.
  if (!existsSync(fullPath)) {
    console.warn(`WARNING: JSandbox bits weren't found at:\n${fullPath}`);
    exit(0);
  }
  const source = decodeURI(join(targetDir, filename));
  const dest = decodeURI(join(import.meta.dirname, "..", ...destination));
  console.log(`Copying\nfrom: "${source}"\nto: "${dest}"`);
  await copyFile(source, dest);
}

await Promise.all([
  copy("jsandbox_bg.js", ["src", "factory.js"]),
  copy("jsandbox_bg.wasm", ["sandbox.wasm"]),
]);
