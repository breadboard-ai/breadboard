/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph, testSubGraph } from "./test-graph.js";
import { deepStrictEqual, ok } from "assert";

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
});
