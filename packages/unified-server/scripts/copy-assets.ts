/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cp } from "fs/promises";
import { join } from "path";

const visualEditorAssetsDir = join(
  import.meta.dirname,
  "../../visual-editor/public"
);

const unifiedServerAssetsDir = join(import.meta.dirname, "../public");

async function main() {
  return cp(visualEditorAssetsDir, unifiedServerAssetsDir, {
    force: true,
    recursive: true,
  });
}

await main();
