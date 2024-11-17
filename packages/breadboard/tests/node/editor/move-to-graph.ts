/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph, testSubGraph } from "./test-graph.js";
import { deepStrictEqual, ok as nodeOk } from "node:assert";
import { MoveToGraphTransform } from "../../../src/editor/transforms/move-to-graph.js";

function ok(result: { success: true } | { success: false; error: string }) {
  return nodeOk(result.success, !result.success ? result.error : "");
}

describe("Move-to-graph transform", async () => {
  await it("moves nodes from main graph to sub-graph", async () => {
    const editor = testEditGraph();
    const addingSubgraph = await editor.edit(
      [
        { type: "addgraph", graph: testSubGraph(), id: "foo" },
        {
          type: "addedge",
          edge: { from: "node0", to: "node2", out: "out", in: "in" },
          graphId: "",
        },
      ],
      ""
    );
    ok(addingSubgraph);
    const moving = await editor.apply(
      new MoveToGraphTransform(["node0"], "", "foo")
    );
    ok(moving);
    const graph = editor.raw();
    deepStrictEqual(graph.nodes.length, 1);
    deepStrictEqual(graph.edges.length, 0);
    deepStrictEqual(graph.graphs?.foo.nodes.length, 1);
    deepStrictEqual(graph.graphs?.foo.edges.length, 1);
  });

  await it("moves nodes from sub-graph to main graph", async () => {
    const editor = testEditGraph();
    const addingSubgraph = await editor.edit(
      [
        { type: "addgraph", graph: testSubGraph(), id: "foo" },
        {
          type: "addnode",
          node: { id: "node10", type: "foo" },
          graphId: "foo",
        },
        {
          type: "addnode",
          node: { id: "node11", type: "foo" },
          graphId: "foo",
        },
        {
          type: "addedge",
          edge: { from: "node10", to: "node11", out: "out", in: "in" },
          graphId: "foo",
        },
      ],
      ""
    );
    ok(addingSubgraph);
    const moving = await editor.apply(
      new MoveToGraphTransform(["node10"], "foo", "")
    );
    ok(moving);
    const graph = editor.raw();
    deepStrictEqual(graph.nodes.length, 3);
    deepStrictEqual(graph.edges.length, 1);
    deepStrictEqual(graph.graphs?.foo.nodes.length, 1);
    deepStrictEqual(graph.graphs?.foo.edges.length, 0);
  });

  await it("moves nodes between sub-graphs", async () => {
    const editor = testEditGraph();
    const addingSubgraph = await editor.edit(
      [
        { type: "addgraph", graph: testSubGraph(), id: "foo" },
        { type: "addgraph", graph: testSubGraph(), id: "bar" },
        {
          type: "addnode",
          node: { id: "node10", type: "foo" },
          graphId: "foo",
        },
        {
          type: "addnode",
          node: { id: "node11", type: "foo" },
          graphId: "foo",
        },
        {
          type: "addedge",
          edge: { from: "node10", to: "node11", out: "out", in: "in" },
          graphId: "foo",
        },
      ],
      ""
    );
    ok(addingSubgraph);
    const moving = await editor.apply(
      new MoveToGraphTransform(["node10", "node11"], "foo", "bar")
    );
    ok(moving);
    const graph = editor.raw();
    deepStrictEqual(graph.nodes.length, 2);
    deepStrictEqual(graph.edges.length, 1);
    deepStrictEqual(graph.graphs?.foo.nodes.length, 0);
    deepStrictEqual(graph.graphs?.foo.edges.length, 0);
    deepStrictEqual(graph.graphs?.bar.nodes.length, 2);
    deepStrictEqual(graph.graphs?.bar.edges.length, 1);
  });
});
