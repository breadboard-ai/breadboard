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
const OUT_DIR = join(ROOT_DIR, "out", "bgl", "src");

await Promise.all(
  BGLS.map(async (bgl) => {
    const destination = join(ROOT_DIR, "bgl", `${bgl}.bgl.json`);
    const bglDir = join(ROOT_DIR, "bgl", "src", bgl);
    const modules = await readdir(join(bglDir));
    const sources: [string, Module][] = [];
    for (const module of modules) {
      const isTypescript = module.endsWith(".ts");
      const isJavascript = module.endsWith(".js");
      const moduleName = module.slice(0, -3);
      let source: string;
      if (isTypescript) {
        // grab a source from `out`
        source = join(OUT_DIR, bgl, `${moduleName}.js`);
      } else if (isJavascript) {
        source = join(bglDir, module);
      } else {
        continue;
      }
      // Do hacky a2 replacement
      const code = (await readFile(source, { encoding: "utf8" })).replace(
        /(from\s+["'])\.\.\/(a2\/[^"']+)/g,
        "$1./$2"
      );

      sources.push([moduleName, { code }]);
    }
    const graph = JSON.parse(
      await readFile(join(bglDir, "bgl.json"), { encoding: "utf8" })
    ) as GraphDescriptor;
    graph.modules = Object.fromEntries(sources);
    await writeFile(destination, JSON.stringify(graph, null, 2), "utf8");
  })
);
