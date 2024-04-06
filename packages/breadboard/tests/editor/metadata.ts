/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { editGraph } from "../../src/editor/index.js";

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

  const result = await graph.canChangeMetadata("node0");
  t.is(result.success, true);

  const newMetadata = { title: "bar" };
  const changeResult = await graph.changeMetadata("node0", newMetadata);
  t.is(changeResult.success, true);

  const changedMetadata = graph.inspect().nodeById("node0")
    ?.descriptor?.metadata;
  t.deepEqual(changedMetadata, newMetadata);

  const invalidResult = await graph.changeMetadata("nonexistentNode", {
    title: "baz",
  });
  t.is(invalidResult.success, false);
});
