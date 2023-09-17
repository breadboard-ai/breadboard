/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import map, { MapInputs } from "../src/nodes/map.js";
import { InputValues } from "@google-labs/graph-runner";

test("map with no board just outputs list", async (t) => {
  const inputs = {
    list: [1, 2, 3],
  } as MapInputs;
  const outputs = await map(inputs);
  t.deepEqual(outputs, { list: [1, 2, 3] });
});

test("map with board wip", async (t) => {
  const inputs = {
    list: [1, 2, 3],
    board: {
      kind: "board",
      board: {
        runOnce: async (inputs: InputValues) => {
          return inputs;
        },
      },
    },
  } as MapInputs;
  const outputs = await map(inputs);
  t.deepEqual(outputs, {
    list: [
      { index: 0, item: 1, list: [1, 2, 3] },
      { index: 1, item: 2, list: [1, 2, 3] },
      { index: 2, item: 3, list: [1, 2, 3] },
    ],
  });
});
