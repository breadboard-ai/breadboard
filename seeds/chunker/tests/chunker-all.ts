/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { BasicChunker } from "../src/index.js";
import { readFile, readdir } from "fs/promises";

const TEST_CASES_DIRECTORY = "./tests/data";

(await readdir(TEST_CASES_DIRECTORY)).forEach(async (testCase) => {
  test(`chunker: ${testCase}`, async (t) => {
    const data = JSON.parse(
      await readFile(`${TEST_CASES_DIRECTORY}/${testCase}`, "utf-8")
    );
    const chunker = new BasicChunker(data.options);
    const result = chunker.chunk(data.input);
    t.deepEqual(result, data.output);
  });
});
