/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cp } from "fs/promises";
import { join } from "path";

const unifiedServerRoot = join(import.meta.dirname, "..");
const unifiedServerAssetsDir = join(unifiedServerRoot, "public");
const unifiedServerIndexHtml = join(unifiedServerRoot, "index.html");
const unifiedServerIconsDir = join(unifiedServerRoot, "icons");

const visualEditorRoot = join(unifiedServerRoot, "../visual-editor");
const visualEditorAssetsDir = join(visualEditorRoot, "public");
const visualEditorIndexHtml = join(visualEditorRoot, "index.html");
const visualEditorIconsDir = join(visualEditorRoot, "icons");

async function main() {
  return Promise.all([
    cp(visualEditorAssetsDir, unifiedServerAssetsDir, {
      force: true,
      recursive: true,
    }),
    cp(visualEditorIconsDir, unifiedServerIconsDir, {
      force: true,
      recursive: true,
    }),
    cp(visualEditorIndexHtml, unifiedServerIndexHtml),
  ]);
}

await main();
