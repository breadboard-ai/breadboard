/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cp } from "node:fs/promises";

let resolvedBoardPath: boolean | string = false;
// @ts-expect-error 2274
if (import.meta.resolve) {
  const boardPath = import.meta.resolve(
    "@breadboard-ai/example-boards/example-boards/*.json"
  );
  resolvedBoardPath = fileURLToPath(boardPath).replace(/\*\.json$/, "");
} else {
  const require = createRequire(import.meta.url);
  const breadboardWebIndex = require.resolve("@breadboard-ai/example-boards");
  resolvedBoardPath = join(dirname(breadboardWebIndex), "..", "example-boards");
}

const destBoardPath = resolve(".", "public", "example-boards");

await cp(resolvedBoardPath, destBoardPath, {
  recursive: true,
  dereference: true,
});
