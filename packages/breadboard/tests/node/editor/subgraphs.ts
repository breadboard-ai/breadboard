/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph, testSubGraph } from "./test-graph.js";
import { deepStrictEqual, ok } from "assert";
import { EditSpec } from "../../../src/index.js";

describe("Sub-graph editing operations", async () => {
  await it("allows adding subgraphs", async () => {
    const graph = testEditGraph();
    const result = await graph.edit(
      [{ type: "addgraph", graph: testSubGraph(), id: "foo" }],
      ""
    );
    ok(result.success);
    deepStrictEqual(graph.raw().graphs?.foo?.title, "Test Subgraph");
  });

  await it("does not allow adding duplicate subgraphs", async () => {
    const graph = testEditGraph();
    const result = await graph.edit(
      [
        { type: "addgraph", graph: testSubGraph(), id: "foo" },
        { type: "addgraph", graph: testSubGraph(), id: "foo" },
      ],
      ""
    );
    ok(!result.success);
  });

  await it("removes subgraphs", async () => {
    const graph = testEditGraph();
    const addition = await graph.edit(
      [{ type: "addgraph", graph: testSubGraph(), id: "foo" }],
      ""
    );
    ok(addition.success);
    deepStrictEqual(graph.raw().graphs?.foo?.title, "Test Subgraph");

    const removal = await graph.edit([{ type: "removegraph", id: "foo" }], "");
    ok(removal.success);
    ok(!graph.raw().graphs);
  });

  await it("doesn't allow removing non-existent subgraphs", async () => {
    const graph = testEditGraph();
    const removal = await graph.edit([{ type: "removegraph", id: "foo" }], "");
    ok(!removal.success);
  });

  await it("can replace graph as atomic remove/add", async () => {
    const graph = testEditGraph();
    const initialization = await graph.edit(
      [{ type: "addgraph", graph: testSubGraph(), id: "foo" }],
      ""
    );
    ok(initialization.success);
    deepStrictEqual(graph.raw().graphs?.foo?.title, "Test Subgraph");

    const newSubGraph = testSubGraph();
    newSubGraph.title = "Foo";

    const replacement = await graph.edit(
      [
        { type: "removegraph", id: "foo" },
        { type: "addgraph", id: "foo", graph: newSubGraph },
      ],
      ""
    );
    ok(replacement.success);
    deepStrictEqual(graph.raw().graphs?.foo?.title, "Foo");
  });

  await it("correctly edits subgraphs", async () => {
    const graph = testEditGraph();
    const initialization = await graph.edit(
      [{ type: "addgraph", graph: testSubGraph(), id: "foo" }],
      ""
    );
    ok(initialization.success);
    deepStrictEqual(graph.raw().graphs?.foo?.title, "Test Subgraph");

    {
      const nodeAddition = await graph.edit([addNode("bar")], "");

      ok(nodeAddition.success);
      const addedNode = graph.raw().graphs?.foo?.nodes[0];
      deepStrictEqual(addedNode, { id: "bar", type: "bar" });
    }

    {
      const nodeRemoval = await graph.edit(
        [{ type: "removenode", id: "bar", graphId: "foo" }],
        ""
      );
      ok(nodeRemoval.success);

      const subgraphNodeLength = graph.raw().graphs?.foo?.nodes.length;
      deepStrictEqual(subgraphNodeLength, 0);
    }

    {
      const subgraphConstruction = await graph.edit(
        [
          addNode("bar"),
          addNode("foo"),
          addEdge("bar", "foo"),
          addEdge("foo", "foo"),
          {
            type: "removeedge",
            graphId: "foo",
            edge: { from: "foo", to: "foo", out: "*", in: "" },
          },
          {
            type: "changeedge",
            graphId: "foo",
            from: { from: "bar", to: "foo", out: "*", in: "" },
            to: { from: "bar", to: "foo", out: "out", in: "in" },
          },
          {
            type: "changeconfiguration",
            graphId: "foo",
            id: "bar",
            configuration: { in: "yay" },
          },
          {
            type: "changemetadata",
            graphId: "foo",
            id: "foo",
            metadata: { visual: { x: 5 } },
          },
          {
            type: "changegraphmetadata",
            graphId: "foo",
            metadata: { tags: ["published"] },
          },
        ],
        ""
      );
      ok(
        subgraphConstruction.success,
        (subgraphConstruction as { error: string }).error
      );

      const resultGraph = graph.raw().graphs?.foo;
      deepStrictEqual(resultGraph?.metadata?.tags, ["published"]);
      const subgraphNodes = resultGraph?.nodes;
      deepStrictEqual(subgraphNodes?.length, 2);
      deepStrictEqual(subgraphNodes?.[0].configuration?.in, "yay");
      deepStrictEqual(
        (subgraphNodes?.[1].metadata?.visual as { x: number }).x,
        5
      );
      const subgraphEdges = graph.raw().graphs?.foo?.edges;
      deepStrictEqual(subgraphEdges?.length, 1);
      deepStrictEqual(subgraphEdges?.[0].in, "in");
    }

    function addNode(id: string): EditSpec {
      return { type: "addnode", graphId: "foo", node: { id, type: "bar" } };
    }

    function addEdge(from: string, to: string): EditSpec {
      return {
        type: "addedge",
        graphId: "foo",
        edge: { from, to, out: "*", in: "" },
      };
    }
  });
});
