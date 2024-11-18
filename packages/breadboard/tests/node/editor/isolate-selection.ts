/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph } from "./test-graph.js";
import { deepStrictEqual, ok } from "node:assert";
import { IsolateSelectionTransform } from "../../../src/editor/transforms/isolate-selection.js";

describe("isolate selection transform", () => {
  it("correctly removes dangling nodes", async () => {
    const graph = testEditGraph();
    const edited = await graph.edit(
      [
        {
          type: "addedge",
          edge: { from: "node0", to: "node2", out: "*", in: "" },
          graphId: "",
        },
      ],
      ""
    );
    ok(edited.success);

    {
      const transform = new IsolateSelectionTransform(["node0"], "");
      const transformed = await graph.apply(transform);
      ok(transformed.success);
      const expected = testEditGraph().raw();
      deepStrictEqual(graph.raw(), expected);
    }
  });

  it("correctly rejects spurious nodes", async () => {
    const graph = testEditGraph();

    const transform = new IsolateSelectionTransform(["node4"], "");
    const transformed = await graph.apply(transform);
    ok(!transformed.success);
    const expected = testEditGraph().raw();
    deepStrictEqual(graph.raw(), expected);
  });
});
