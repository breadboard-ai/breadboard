/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PATH = path.join(MODULE_DIR, "boards");
const GRAPH_PATH = path.join(MODULE_DIR, "../public");

const saveAllBoards = async () => {
  const files = await readdir(PATH);
  for (const file of files) {
    if (file.endsWith(".ts")) {
      const board = await import(path.join(PATH, file));
      writeFile(
        path.join(GRAPH_PATH, file.replace(".ts", ".json")),
        JSON.stringify(board.default, null, 2)
      );
    }
  }
};

saveAllBoards();
