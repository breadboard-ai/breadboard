/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { NodeMetadata } from "@breadboard-ai/types";
import { editGraph } from "../helpers/_editor.js";

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
  const graphId = "";
  const metadata = graph.inspect("").nodeById("node0")?.descriptor?.metadata;
  t.is(metadata, undefined);

  const result = await graph.edit(
    [{ type: "changemetadata", id: "node0", metadata: {}, graphId }],
    "test",
    true
  );
  t.is(result.success, true);

  const newMetadata = { title: "bar" };
  const changeResult = await graph.edit(
    [{ type: "changemetadata", id: "node0", metadata: newMetadata, graphId }],
    "test"
  );
  t.is(changeResult.success, true);

  const changedMetadata = graph.inspect("").nodeById("node0")
    ?.descriptor?.metadata;
  t.deepEqual(changedMetadata, newMetadata);

  const invalidResult = await graph.edit(
    [
      {
        type: "changemetadata",
        id: "nonexistentNode",
        metadata: { title: "baz" },
        graphId,
      },
    ],
    "test"
  );
  t.is(invalidResult.success, false);
});

test("editGraph correctly edits visual node metadata", async (t) => {
  const graph = testEditGraph();
  const graphId = "";
  const metadata = graph.inspect("").nodeById("node0")?.descriptor?.metadata;
  t.is(metadata, undefined);

  const result = await graph.edit(
    [{ type: "changemetadata", id: "node0", metadata: {}, graphId }],
    "test",
    true
  );
  t.is(result.success, true);

  const newMetadata = { visual: { icon: "cool" } } satisfies NodeMetadata;
  graph.addEventListener("graphchange", (evt) => {
    t.true(evt.visualOnly);
  });
  const changeResult = await graph.edit(
    [{ type: "changemetadata", id: "node0", metadata: newMetadata, graphId }],
    "test"
  );
  t.is(changeResult.success, true);

  const changedMetadata = graph.inspect("").nodeById("node0")
    ?.descriptor?.metadata;
  t.deepEqual(changedMetadata, newMetadata);

  const invalidResult = await graph.edit(
    [
      {
        type: "changemetadata",
        id: "nonexistentNode",
        metadata: { title: "baz" },
        graphId,
      },
    ],
    "test"
  );
  t.is(invalidResult.success, false);
});

test("editGraph correctly distinguishes between `reset` and incremental graph metadata changes", async (t) => {
  const graph = testEditGraph();
  const graphId = "";

  const result = await graph.edit(
    [
      {
        type: "changemetadata",
        id: "node0",
        metadata: { title: "hello" },
        graphId,
      },
      {
        type: "changemetadata",
        id: "node0",
        metadata: { visual: { x: 8, y: 10 } },
        graphId,
      },
    ],
    "test"
  );
  t.is(result.success, true);
  const changedMetadata = graph.inspect("").nodeById("node0")
    ?.descriptor?.metadata;
  t.deepEqual(changedMetadata, { title: "hello", visual: { x: 8, y: 10 } });
});
