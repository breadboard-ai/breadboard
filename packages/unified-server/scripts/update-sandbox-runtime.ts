/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { copyFile, mkdir } from "fs/promises";
import { join } from "path";

const jsandboxWasmPath = new URL(
  import.meta.resolve("@breadboard-ai/jsandbox/sandbox.wasm")
).pathname;

async function main() {
  const dir = join(import.meta.dirname, "../public");
  await mkdir(dir, { recursive: true });

  const dest = join(dir, "sandbox.wasm");
  console.log(`Copying\nfrom: "${jsandboxWasmPath}"\nto: "${dest}"`);
  await copyFile(jsandboxWasmPath, dest);
}

await main();
