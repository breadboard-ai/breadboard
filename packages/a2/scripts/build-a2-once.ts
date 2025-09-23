/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Module, GraphDescriptor } from "@breadboard-ai/types";
import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Constructs BGLs from the source files and BGL stubs.
 */

/**
 * The list of BGLs that will be constructed.
 */
const BGLS = [
  "a2",
  "audio-generator",
  "file-system",
  "folio",
  "generate",
  "generate-text",
  "gmail",
  "go-over-list",
  "google-drive",
  "mcp",
  "save-outputs",
  "tools",
  "video-generator",
  "music-generator",
  "deep-research",
];

const ROOT_DIR = join(import.meta.dirname, "..");
const DESTINATION = join(ROOT_DIR, "src", "a2.ts");
const imports: string[] = [];

const bglMap = new Map<string, Set<string>>();

await Promise.all(
  BGLS.map(async (bgl) => {
    const set = new Set<string>();
    bglMap.set(bgl, set);
    const bglDir = join(ROOT_DIR, "bgl", "src", bgl);
    const modules = await readdir(join(bglDir));
    for (const module of modules) {
      const isTypescript = module.endsWith(".ts");
      const isJavascript = module.endsWith(".js");
      if (!isTypescript && !isJavascript) continue;
      const moduleName = module.slice(0, -3);
      set.add(moduleName);
      imports.push(
        `import * as ${dashToCamel(`${bgl}-${moduleName}`)} from "../bgl/src/${bgl}/${moduleName}"`
      );
    }
  })
);

const groups: string[] = [];
bglMap.forEach((modules, bgl) => {
  const lines: string[] = [];
  modules.forEach((module) => {
    lines.push(`"${module}": ${dashToCamel(`${bgl}-${module}`)},`);
  });
  groups.push(`"${bgl}": {
  ${lines.join("\n")}
  },`);
});

const all = `export const a2 = {

${groups.join("\n")}

}`;

await writeFile(
  DESTINATION,
  `${imports.join("\n")}
${all}`,
  "utf8"
);
function dashToCamel(str: string): string {
  if (!str) {
    return "";
  }

  return str.replace(/-(\w)/g, (_, char) => char.toUpperCase());
}
