/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cp } from "fs/promises";
import { join } from "path";

const unifiedServerRoot = join(import.meta.dirname, "..");
const dirsToCopyFromVisualEditor = [
  "public",
  "icons",
  "oauth",
  "landing",
  "langs",
];
const filesToCopyFromVisualEditor = ["index.html"];

const unifiedServerLandingStylesSrcDir = join(
  unifiedServerRoot,
  "landing/styles"
);
const unifiedServerLandingStylesDestDir = join(
  unifiedServerRoot,
  "public/styles/landing"
);

const visualEditorRoot = join(unifiedServerRoot, "../visual-editor");

async function main() {
  await Promise.all(
    dirsToCopyFromVisualEditor.map((dir) =>
      cp(join(visualEditorRoot, dir), join(unifiedServerRoot, dir), {
        force: true,
        recursive: true,
      })
    )
  );

  await Promise.all(
    filesToCopyFromVisualEditor.map((file) =>
      cp(join(visualEditorRoot, file), join(unifiedServerRoot, file), {
        force: true,
      })
    )
  );

  await cp(
    unifiedServerLandingStylesSrcDir,
    unifiedServerLandingStylesDestDir,
    {
      recursive: true,
      force: true,
    }
  );
}

await main();
