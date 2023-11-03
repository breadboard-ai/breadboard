/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { toMermaid } from "@google-labs/breadboard";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PATH = path.join(MODULE_DIR, "boards");
const MANIFEST_PATH = path.join(MODULE_DIR, "../public");
const GRAPH_PATH = path.join(MODULE_DIR, "../public/graphs");
const DIAGRAM_PATH = path.join(MODULE_DIR, "../docs/graphs");

await mkdir(GRAPH_PATH, { recursive: true });
await mkdir(DIAGRAM_PATH, { recursive: true });

const saveAllBoards = async () => {
  const files = await readdir(PATH);
  const manifest = [];
  for (const file of files) {
    if (file.endsWith(".ts")) {
      const board = await import(path.join(PATH, file));
      const jsonFile = file.replace(".ts", ".json");
      manifest.push({
        title: board.default.title,
        url: `/graphs/${jsonFile}`,
      });
      await writeFile(
        path.join(GRAPH_PATH, jsonFile),
        JSON.stringify(board.default, null, 2)
      );
      await writeFile(
        path.join(DIAGRAM_PATH, file.replace(".ts", ".md")),
        `## ${file}\n\n\`\`\`mermaid\n${toMermaid(board.default)}\n\`\`\``
      );
    }
  }
  await writeFile(
    path.join(MANIFEST_PATH, "local-boards.json"),
    JSON.stringify(manifest, null, 2)
  );
};

await saveAllBoards();
