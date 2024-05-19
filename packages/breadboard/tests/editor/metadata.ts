/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { editGraph } from "../../src/editor/index.js";
import { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";

const testEditGraph = () => {
  return editGraph(
    structuredClone({
      nodes: [
        {
          id: "node0",
          type: "foo",
        },
        {
          id: "node2",
          type: "bar",
        },
      ],
      edges: [{ from: "node0", out: "out", to: "node0", in: "in" }],
    }),
    {}
  );
};

test("editGraph correctly edits node metadata", async (t) => {
  const graph = testEditGraph();
  const metadata = graph.inspect().nodeById("node0")?.descriptor?.metadata;
  t.is(metadata, undefined);

  const result = await graph.edit(
    [{ type: "changemetadata", id: "node0", metadata: {} }],
    "test",
    true
  );
  console.log(result);
  t.is(result.success, true);

  const newMetadata = { title: "bar" };
  const changeResult = await graph.edit(
    [{ type: "changemetadata", id: "node0", metadata: newMetadata }],
    "test"
  );
  t.is(changeResult.success, true);
  t.is(graph.version(), 1);

  const changedMetadata = graph.inspect().nodeById("node0")
    ?.descriptor?.metadata;
  t.deepEqual(changedMetadata, newMetadata);

  const invalidResult = await graph.edit(
    [
      {
        type: "changemetadata",
        id: "nonexistentNode",
        metadata: { title: "baz" },
      },
    ],
    "test"
  );
  t.is(invalidResult.success, false);
  t.is(graph.version(), 1);
});

test("editGraph correctly edits visual node metadata", async (t) => {
  const graph = testEditGraph();
  const metadata = graph.inspect().nodeById("node0")?.descriptor?.metadata;
  t.is(metadata, undefined);

  const result = await graph.edit(
    [{ type: "changemetadata", id: "node0", metadata: {} }],
    "test",
    true
  );
  t.is(result.success, true);

  const newMetadata = { visual: { icon: "cool" } } satisfies NodeMetadata;
  graph.addEventListener("graphchange", (evt) => {
    t.true(evt.visualOnly);
  });
  const changeResult = await graph.edit(
    [{ type: "changemetadata", id: "node0", metadata: newMetadata }],
    "test"
  );
  t.is(changeResult.success, true);
  t.is(graph.version(), 1);

  const changedMetadata = graph.inspect().nodeById("node0")
    ?.descriptor?.metadata;
  t.deepEqual(changedMetadata, newMetadata);

  const invalidResult = await graph.edit(
    [
      {
        type: "changemetadata",
        id: "nonexistentNode",
        metadata: { title: "baz" },
      },
    ],
    "test"
  );
  t.is(invalidResult.success, false);
  t.is(graph.version(), 1);
});
