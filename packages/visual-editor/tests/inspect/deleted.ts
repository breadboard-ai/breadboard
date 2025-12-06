/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph, testFilledOutSubGraph } from "../editor/test-graph.js";
import { ok } from "node:assert";

describe("InspectableEdge.deleted", async () => {
  await it("is correctly set when node is removed", async () => {
    const editor = testEditGraph();
    const inspector = editor.inspect("");
    const node = inspector.nodes().at(0);
    ok(node);
    ok(!node.deleted());

    const removedNode = await editor.edit(
      [{ type: "removenode", graphId: "", id: node.descriptor.id }],
      ""
    );
    ok(removedNode.success);

    ok(node.deleted());
  });

  await it("is correctly set when an edge is removed", async () => {
    const editor = testEditGraph();
    const inspector = editor.inspect("");
    const edge = inspector.edges().at(0);
    ok(edge);
    ok(!edge.deleted());

    const removeEdge = await editor.edit(
      [{ type: "removeedge", graphId: "", edge: edge.raw() }],
      ""
    );
    ok(removeEdge.success);

    ok(edge.deleted());
  });

  await it("is correctly set when graph is removed", async () => {
    const editor = testEditGraph();
    const addedGraph = await editor.edit(
      [
        {
          type: "addgraph",
          graph: testFilledOutSubGraph(),
          id: "foo",
        },
      ],
      ""
    );
    ok(addedGraph.success);

    const inspector = editor.inspect("foo");
    const node = inspector.nodes().at(0);
    ok(node);
    ok(!node?.deleted());

    const edge = inspector.edges().at(0);
    ok(edge);
    ok(!edge.deleted());

    const removedGraph = await editor.edit(
      [{ type: "removegraph", id: "foo" }],
      ""
    );

    ok(removedGraph.success);

    ok(node.deleted());
    ok(edge.deleted());
  });
});
