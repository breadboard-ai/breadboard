/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { testEditGraph } from "./graph.js";

test("editGraph correctly edits node configuration", async (t) => {
  const graph = testEditGraph();
  const graphId = "";
  const old = graph.inspect("").nodeById("node0")?.descriptor?.configuration;

  t.deepEqual(old, undefined);

  const result = await graph.edit(
    [
      {
        type: "changeconfiguration",
        id: "node0",
        configuration: { title: "hello " },
        graphId,
      },
    ],
    "test"
  );

  t.is(result.success, true);
  t.deepEqual(graph.inspect("").nodeById("node0")?.descriptor?.configuration, {
    title: "hello ",
  });

  const changeResult = await graph.edit(
    [
      {
        type: "changeconfiguration",
        id: "node0",
        configuration: { description: "world" },
        graphId,
      },
    ],
    "test"
  );

  t.is(changeResult.success, true);
  t.deepEqual(graph.inspect("").nodeById("node0")?.descriptor?.configuration, {
    title: "hello ",
    description: "world",
  });

  const resetResult = await graph.edit(
    [
      {
        type: "changeconfiguration",
        id: "node0",
        configuration: { title: "goodbye" },
        reset: true,
        graphId,
      },
    ],
    "test"
  );
  t.is(resetResult.success, true);
  t.deepEqual(graph.inspect("").nodeById("node0")?.descriptor?.configuration, {
    title: "goodbye",
  });
});
