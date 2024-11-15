/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import map from "../src/nodes/map.js";
import { Capability, Board, invokeGraph } from "@google-labs/breadboard";
import { Core } from "../src/index.js";

test("map with no board just outputs list", async (t) => {
  const inputs = {
    list: [1, 2, 3],
  };
  const outputs = await map.invoke(inputs, {});
  t.deepEqual(outputs, { list: [1, 2, 3] });
});

test("sending a real board to a map", async (t) => {
  const fun = new Board();
  fun.input().wire("*->", fun.output());

  const board = new Board();
  const core = board.addKit(Core);
  const input = board.input();
  const map = core.map({
    board: {
      kind: "board",
      board: fun,
    } as Capability, // TODO: Fix types.
  });
  input.wire("list->", map);
  map.wire("list->", board.output());
  const outputs = await invokeGraph(
    { graph: board },
    { list: [1, 2, 3] },
    {
      kits: [core],
    }
  );
  t.deepEqual(outputs, {
    list: [
      { index: 0, item: 1, list: [1, 2, 3] },
      { index: 1, item: 2, list: [1, 2, 3] },
      { index: 2, item: 3, list: [1, 2, 3] },
    ],
  });
});
