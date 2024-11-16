/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph, testSubGraph } from "./test-graph.js";
import { deepStrictEqual, ok } from "assert";

describe("Sub-graph editing operations", async () => {
  await it("creates a subgraph", async () => {
    const graph = testEditGraph();
    const result = await graph.edit(
      [{ type: "addgraph", graph: testSubGraph(), id: "foo" }],
      ""
    );
    ok(result.success);
    deepStrictEqual(graph.raw().graphs?.foo?.title, "Test Subgraph");
  });

  await it("does not allow creating duplicate subgraphs", async () => {
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
});
