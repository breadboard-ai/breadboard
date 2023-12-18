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

let files = await readdir(PATH);

const args = process.argv.slice(2);
if (args.length)
  files = files.filter((file) => args.find((arg) => file.includes(arg)));

for (const file of files) {
  console.log("Running " + file);

  const board = await import(`${PATH}/${file}`);
  const example = board.example;
  const resultPromise = example ? board.graph(example) : board.graph;
  try {
    console.log(await resultPromise);
  } catch (e) {
    console.log(e);
  }
}
