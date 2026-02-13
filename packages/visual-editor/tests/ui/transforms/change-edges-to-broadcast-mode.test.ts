/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChangeEdgesToBroadcastMode } from "../../../src/ui/transforms/change-edges-to-broadcast-mode.js";
import {
  createMockGraph,
  createMockContext,
  makeMockEdge,
} from "./mock-edit-context.js";

describe("ChangeEdgesToBroadcastMode", () => {
  it("fails if graph not found", async () => {
    const graph = createMockGraph({
      nodeId: "gen-text",
      outgoingEdges: [],
    });
    const { context } = createMockContext(graph, "other-graph");

    const transform = new ChangeEdgesToBroadcastMode("gen-text", "missing");
    const result = await transform.apply(context);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing"));
    }
  });

  it("fails if node not found", async () => {
    const graph = createMockGraph({
      nodeId: "gen-text",
      outgoingEdges: [],
    });
    const { context } = createMockContext(graph);

    const transform = new ChangeEdgesToBroadcastMode("missing-node", "main");
    const result = await transform.apply(context);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing-node"));
    }
  });

  it("deletes all outgoing edges", async () => {
    const graph = createMockGraph({
      nodeId: "gen-text",
      outgoingEdges: [
        makeMockEdge("gen-text", "water", "water", "context"),
        makeMockEdge("gen-text", "cheese", "cheese", "context"),
      ],
    });
    const { context, appliedEdits } = createMockContext(graph);

    const transform = new ChangeEdgesToBroadcastMode("gen-text", "main");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);

    const edits = appliedEdits[0];
    assert.equal(edits.length, 2);
    assert.ok(edits.every((e) => e.type === "removeedge"));

    if (edits[0].type === "removeedge") {
      assert.equal(edits[0].edge.to, "water");
    }
    if (edits[1].type === "removeedge") {
      assert.equal(edits[1].edge.to, "cheese");
    }
  });

  it("produces no edits when there are no outgoing edges", async () => {
    const graph = createMockGraph({
      nodeId: "gen-text",
      outgoingEdges: [],
    });
    const { context, appliedEdits } = createMockContext(graph);

    const transform = new ChangeEdgesToBroadcastMode("gen-text", "main");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
    assert.equal(appliedEdits[0].length, 0);
  });
});
