/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { notOk, ok, testEditGraph, testSubGraph } from "./test-graph.js";
import { deepStrictEqual } from "node:assert";
import { MoveToNewGraphTransform } from "../../../src/editor/transforms/move-to-new-graph.js";

describe("Move-to-new-graph transform", async () => {
  await it("correctly creates a new subgraph", async () => {
    const editor = testEditGraph();
    const moving = await editor.apply(
      new MoveToNewGraphTransform(["node0"], "", "foo", "Hello", "World")
    );
    ok(moving);
    const graph = editor.raw();
    deepStrictEqual(graph.nodes.length, 1);
    deepStrictEqual(graph.edges.length, 0);
    deepStrictEqual(graph.graphs?.foo.nodes.length, 1);
    deepStrictEqual(graph.graphs?.foo.edges.length, 1);
    deepStrictEqual(graph.graphs?.foo.title, "Hello");
    deepStrictEqual(graph.graphs?.foo.description, "World");
  });

  await it("errors out when duplicating subgraph", async () => {
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
      new MoveToNewGraphTransform(["node0"], "", "foo", "Hello", "World")
    );
    notOk(moving);
  });

  await it("errors out when moving non-existent nodes", async () => {
    const editor = testEditGraph();
    const moving = await editor.apply(
      new MoveToNewGraphTransform(["node1"], "", "foo", "Hello", "World")
    );
    notOk(moving);
  });
});
