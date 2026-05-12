/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from "child_process";
import path from "path";

const args = process.argv.slice(2);
const hiveName = args[0];
if (!hiveName) {
  console.error("Usage: npm run hiveval <hive-name> [template-name]");
  process.exit(1);
}
const templateName = args[1] || hiveName;

const pythonPath = path.resolve(".venv/bin/python");
const hiveDir = path.resolve("../../hives", hiveName);

const result = spawnSync(
  pythonPath,
  ["-m", "bees.eval", "run", hiveDir, "--root", templateName],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
