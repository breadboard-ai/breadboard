/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { copyFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";

/**
 * Copies the `environment.dt.s` from the jsandbox package so that it's
 * always up to date.
 */

const ROOT_DIR = join(import.meta.dirname, "..");
const source = fileURLToPath(
  import.meta.resolve("@breadboard-ai/jsandbox/environment.d.ts")
);

const DESTINATION_PATH = join(ROOT_DIR, "bgl/src/environment.d.ts");

await copyFile(source, DESTINATION_PATH);
