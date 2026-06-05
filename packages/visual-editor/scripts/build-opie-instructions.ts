/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reads Markdown segments from src/a2/agent/graph-editing/instructions/
 * and generates instructions/generated.ts.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTRUCTIONS_DIR = resolve(
  __dirname,
  "../src/a2/agent/graph-editing/instructions"
);
const OUT_PATH = resolve(
  INSTRUCTIONS_DIR,
  "generated.ts"
);

function getSegmentsFromDir(dirName: string): string[] {
  const dirPath = resolve(INSTRUCTIONS_DIR, dirName);
  try {
    const files = readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"))
      .sort();
    return files.map((file) => {
      const fullPath = resolve(dirPath, file);
      return readFileSync(fullPath, "utf-8").trim();
    });
  } catch (err) {
    console.warn(`Warning: Could not read instructions from ${dirName}:`, err);
    return [];
  }
}

function main() {
  try {
    const common = getSegmentsFromDir("common");
    const builder = getSegmentsFromDir("builder");
    const guide = getSegmentsFromDir("guide");

    const outputCode = [
      "/**",
      " * @license",
      " * Copyright 2026 Google LLC",
      " * SPDX-License-Identifier: Apache-2.0",
      " *",
      " * AUTO-GENERATED from src/a2/agent/graph-editing/instructions/ subdirectories",
      " * Do not edit manually. Run: npm run build:opie-instructions",
      " */",
      "",
      "/* eslint-disable */",
      "",
      `export const commonSegments: string[] = [`,
      ...common.map((content) => `  ${JSON.stringify(content)},`),
      "];",
      "",
      `export const builderSegments: string[] = [`,
      ...builder.map((content) => `  ${JSON.stringify(content)},`),
      "];",
      "",
      `export const guideSegments: string[] = [`,
      ...guide.map((content) => `  ${JSON.stringify(content)},`),
      "];",
      ""
    ].join("\n");

    writeFileSync(OUT_PATH, outputCode);
    console.log(`✓ Generated instructions → ${OUT_PATH}`);
    console.log(`  - Common: ${common.length} segments`);
    console.log(`  - Builder: ${builder.length} segments`);
    console.log(`  - Guide: ${guide.length} segments`);
  } catch (err) {
    console.error("Failed to generate Opie instructions:", err);
    process.exit(1);
  }
}

main();
