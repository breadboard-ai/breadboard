/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfigFromArgv, type Config } from "../config.js";
import { join } from "node:path";

function resolved(path: string): string {
  return join(import.meta.dirname, "..", "..", path);
}

test("read config", () => {
  assert.deepEqual(
    readConfigFromArgv([
      "node",
      "script",
      "--tsconfig=path/to/tsconfig.json",
      "--out=path/to/out/dir",
      "path/to/foo.ts",
      "path/to/bar.ts",
    ]),
    {
      inputPaths: [resolved("path/to/foo.ts"), resolved("path/to/bar.ts")],
      outputDir: resolved("path/to/out/dir"),
      tsconfigPath: resolved("path/to/tsconfig.json"),
    } satisfies Config
  );
});
