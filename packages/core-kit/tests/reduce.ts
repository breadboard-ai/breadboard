/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input, serialize } from "@breadboard-ai/build";
import {
  asRuntimeKit,
  createLoader,
  invokeGraph,
} from "@google-labs/breadboard";
import test from "ava";
import Core, { code, coreKit } from "../src/index.js";

test("reduce with no board just outputs accumulator", async (t) => {
  const inputs = {
    list: [1, 2, 3],
    accumulator: 0,
  };
  const outputs = await coreKit.reduce.invoke(inputs, {});
  t.deepEqual(outputs, { accumulator: 0 });
});

test("using reduce as part of a board", async (t) => {
  const innerBoard = (() => {
    const accumulator = input({ type: "number" });
    const item = input({ type: "number" });
    const adder = code(
      { accumulator, item },
      { accumulator: "number" },
      ({ accumulator, item }) => {
        const sum = (accumulator || 0) + (item || 0);
        return { accumulator: sum };
      }
    );
    return board({
      inputs: { accumulator, item },
      outputs: { accumulator: adder.outputs.accumulator },
    });
  })();

  const outerBoard = (() => {
    const value = input({ type: "number" });
    const reducer = coreKit.reduce({
      list: [1, 2, 3],
      accumulator: value,
      board: innerBoard,
    });
    return board({
      inputs: { value },
      outputs: { value: reducer.outputs.accumulator },
    });
  })();

  const result = await invokeGraph(
    { graph: serialize(outerBoard) },
    { value: 10 },
    { kits: [asRuntimeKit(Core)], loader: createLoader() }
  );
  t.falsy(result.$error);
  t.is(result.value, 10);
});
