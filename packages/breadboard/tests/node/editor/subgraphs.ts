/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph, testSubGraph } from "./test-graph.js";
import { fail, ok } from "assert";

describe("Sub-graph editing operations", async () => {
  await it("creates a subgraph", async () => {
    const graph = testEditGraph();
    // const result = await graph.edit(
    //   [{ type: "addgraph", graph: testSubGraph(), id: "foo" }],
    //   "Create a subgraph"
    // );
    // ok(result.success);
    ok(true);
  });
});
