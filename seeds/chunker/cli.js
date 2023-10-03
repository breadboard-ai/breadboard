#!/usr/bin/env node
import process, { exit } from "process";
import { readFile } from "fs/promises";

import { BasicChunker } from "./dist/src/index.js";

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const filename = process.argv[2];
if (!filename) {
  console.log("Give me a path to a file with structured data (JSON) to chunk");
  exit(1);
}

const data = JSON.parse(await readFile(filename));

console.log(`Chunking ${filename} ...`);

const chunker = new BasicChunker();
const result = chunker.chunk(data);

console.log("DONE", result);
