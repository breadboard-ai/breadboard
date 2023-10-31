/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { toMermaid } from "@google-labs/breadboard";
import { readdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PATH = path.join(MODULE_DIR, "boards");
const GRAPH_PATH = path.join(MODULE_DIR, "../public");
const DIAGRAM_PATH = path.join(MODULE_DIR, "../docs/graphs");

const saveAllBoards = async () => {
  const files = await readdir(PATH);
  for (const file of files) {
    if (file.endsWith(".ts")) {
      const board = await import(path.join(PATH, file));
      await writeFile(
        path.join(GRAPH_PATH, file.replace(".ts", ".json")),
        JSON.stringify(board.default, null, 2)
      );
      await writeFile(
        path.join(DIAGRAM_PATH, file.replace(".ts", ".md")),
        `## ${file}\n\n\`\`\`mermaid\n${toMermaid(board.default)}\n\`\`\``
      );
    }
  }
};

saveAllBoards();
