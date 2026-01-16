/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "url";

function getCoverageStats() {
  const SUMMARY_PATH = [
    "..",
    "packages",
    "visual-editor",
    "coverage",
    "coverage-summary.json",
  ];

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const json = readFileSync(path.join(__dirname, ...SUMMARY_PATH), "utf8");
    const { total } = JSON.parse(json);

    return {
      lines: total.lines.pct,
      funcs: total.functions.pct,
      branches: total.branches.pct,
    };
  } catch (error) {
    console.warn(`⚠️ Could not read coverage summary from ${SUMMARY_PATH}`);
    console.warn(error.message);
    return null;
  }
}

const stats = getCoverageStats();
if (stats) {
  console.log(
    `Lines: ${stats.lines}% | Functions: ${stats.funcs}% | Branches: ${stats.branches}%`
  );
}
