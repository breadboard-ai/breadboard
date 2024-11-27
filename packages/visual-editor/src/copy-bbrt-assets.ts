/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cp } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..");
const PUBLIC_DIR = join(ROOT_DIR, "public");
const BBRT_DIR = dirname(
  new URL(import.meta.resolve("@breadboard-ai/bbrt/package.json")).pathname
);

await cp(join(BBRT_DIR, "images"), join(PUBLIC_DIR, "bbrt", "images"), {
  recursive: true,
});
