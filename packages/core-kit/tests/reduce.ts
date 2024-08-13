/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import reduce from "../src/nodes/reduce.js";
import Core, { core } from "../src/index.js";
import {
  asRuntimeKit,
  code,
  board,
  invokeGraph,
} from "@google-labs/breadboard";

test("reduce with no board just outputs accumulator", async (t) => {
  const inputs = {
    list: [1, 2, 3],
    accumulator: 0,
  };
  const outputs = await reduce.invoke(inputs, {});
  t.deepEqual(outputs, { accumulator: 0 });
});

test("using reduce as part of a board", async (t) => {
  const reducer = await board(({ value }) => {
    const { accumulator } = core.reduce({
      list: [1, 2, 3],
      accumulator: value,
      board: code(({ accumulator, item }) => {
        const sum = ((accumulator || 0) as number) + ((item || 0) as number);
        return { accumulator: sum };
      }),
    });
    return { value: accumulator.isNumber() };
  }).serialize();
  const { value } = await invokeGraph(
    reducer,
    { value: 4 },
    { kits: [asRuntimeKit(Core)] }
  );
  t.is(value, 10);
});
