/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { ok, testEditGraph, testSubGraph } from "./test-graph.js";
import { deepStrictEqual } from "node:assert";
import { MergeGraphTransform } from "../../../src/editor/transforms/merge-graph.js";

describe("Merging graphs", async () => {
  await it("Correctly merges subgraph", async () => {
    const editor = testEditGraph();
    const addingSubgraph = await editor.edit(
      [
        { type: "addgraph", graph: testSubGraph(), id: "foo" },
        { type: "addnode", node: { type: "foo", id: "node1" }, graphId: "foo" },
      ],
      ""
    );
    ok(addingSubgraph);
    const merging = await editor.apply(new MergeGraphTransform("foo", ""));
    ok(merging);

    const graph = editor.raw();
    deepStrictEqual(graph.nodes.length, 3);
    deepStrictEqual(graph.graphs, undefined);
  });
});
