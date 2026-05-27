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

function main() {
  try {
    const files = readdirSync(INSTRUCTIONS_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort();

    const segments: string[] = files.map((file) => {
      const fullPath = resolve(INSTRUCTIONS_DIR, file);
      return readFileSync(fullPath, "utf-8").trim();
    });

    const outputCode = [
      "/**",
      " * @license",
      " * Copyright 2026 Google LLC",
      " * SPDX-License-Identifier: Apache-2.0",
      " *",
      " * AUTO-GENERATED from src/a2/agent/graph-editing/instructions/*.md",
      " * Do not edit manually. Run: npm run build:opie-instructions",
      " */",
      "",
      "/* eslint-disable */",
      "",
      `export const segments: string[] = [`,
      ...segments.map((content) => `  ${JSON.stringify(content)},`),
      "];",
      ""
    ].join("\n");

    writeFileSync(OUT_PATH, outputCode);
    console.log(`✓ Generated ${files.length} segments → ${OUT_PATH}`);
  } catch (err) {
    console.error("Failed to generate Opie instructions:", err);
    process.exit(1);
  }
}

main();
