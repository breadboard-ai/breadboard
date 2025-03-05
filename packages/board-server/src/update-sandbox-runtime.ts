/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { copyFile } from "fs/promises";
import { join } from "path";

const jsandboxWasmPath = new URL(
  import.meta.resolve("@breadboard-ai/jsandbox/sandbox.wasm")
).pathname;

async function copy(destination: string[]) {
  const dest = decodeURI(join(import.meta.dirname, "..", ...destination));
  console.log(`Copying\nfrom: "${jsandboxWasmPath}"\nto: "${dest}"`);
  await copyFile(jsandboxWasmPath, dest);
}

await Promise.all([copy(["public", "sandbox.wasm"])]);
