/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph } from "./test-graph.js";
import { computeSelection } from "../../../src/editor/selection.js";
import { deepStrictEqual, ok } from "node:assert";

describe("Computing selection", async () => {
  it("reports an error when trying to select non-existent node", () => {
    const graph = testEditGraph();
    const inspectable = graph.inspect("");
    const selection = computeSelection(inspectable, ["foo"]);
    ok(!selection.success);
  });

  it("computes single-node selection", () => {
    const graph = testEditGraph();
    const inspectable = graph.inspect("");
    {
      const selection = computeSelection(inspectable, ["node0"]);
      deepStrictEqual(selection, {
        success: true,
        nodes: ["node0"],
        edges: [{ from: "node0", out: "out", to: "node0", in: "in" }],
        dangling: [],
      });
    }
    {
      const selection = computeSelection(inspectable, ["node2"]);
      deepStrictEqual(selection, {
        success: true,
        nodes: ["node2"],
        edges: [],
        dangling: [],
      });
    }
    {
      const selection = computeSelection(inspectable, ["node2"]);
      deepStrictEqual(selection, {
        success: true,
        nodes: ["node2"],
        edges: [],
        dangling: [],
      });
    }
  });

  await it("computes dangling edges", async () => {
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
    const inspectable = graph.inspect("");
    {
      const selection = computeSelection(inspectable, ["node0"]);
      deepStrictEqual(selection, {
        success: true,
        nodes: ["node0"],
        edges: [{ from: "node0", out: "out", to: "node0", in: "in" }],
        dangling: [{ from: "node0", out: "*", to: "node2", in: "" }],
      });
    }
  });
});
