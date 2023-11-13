/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readdir } from "fs/promises";

config();

const MODULE_DIR: string = path.dirname(fileURLToPath(import.meta.url));
const PATH: string = path.join(MODULE_DIR, "../boards/new");

const files = await readdir(PATH);
console.log(PATH, files);

for (const file of files) {
  console.log("Running " + file);

  try {
    const board = await import(`${PATH}/${file}`);
    const result = await board.graph;

    console.log(result);
  } catch (e) {
    console.error(e);
  }
}
