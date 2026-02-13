/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChangeEdgesToRoutingMode } from "../../../src/ui/transforms/change-edges-to-routing-mode.js";
import {
  createMockGraph,
  createMockContext,
  makeMockEdge,
  routingConfig,
} from "./mock-edit-context.js";

describe("ChangeEdgesToRoutingMode", () => {
  describe("error handling", () => {
    it("fails if graph not found", async () => {
      const graph = createMockGraph({
        nodeId: "node-1",
        outgoingEdges: [],
      });
      const { context } = createMockContext(graph, "other-graph");

      const transform = new ChangeEdgesToRoutingMode(
        "node-1",
        "missing-graph",
        routingConfig("target-1")
      );
      const result = await transform.apply(context);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.includes("missing-graph"));
      }
    });

    it("fails if node not found", async () => {
      const graph = createMockGraph({
        nodeId: "node-1",
        outgoingEdges: [],
      });
      const { context } = createMockContext(graph);

      const transform = new ChangeEdgesToRoutingMode(
        "missing-node",
        "main",
        routingConfig("target-1")
      );
      const result = await transform.apply(context);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.includes("missing-node"));
      }
    });
  });

  describe("edge creation", () => {
    it("creates edges for route targets with no existing edges", async () => {
      const graph = createMockGraph({
        nodeId: "gen-text",
        outgoingEdges: [],
        knownNodeIds: ["water", "cheese"],
      });
      const { context, appliedEdits } = createMockContext(graph);

      const transform = new ChangeEdgesToRoutingMode(
        "gen-text",
        "main",
        routingConfig("water", "cheese")
      );
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      assert.equal(appliedEdits.length, 1);
      const edits = appliedEdits[0];

      const addEdits = edits.filter((e) => e.type === "addedge");
      assert.equal(addEdits.length, 2);

      const waterEdge = addEdits.find(
        (e) => e.type === "addedge" && e.edge.to === "water"
      );
      assert.ok(waterEdge);
      if (waterEdge?.type === "addedge") {
        assert.equal(waterEdge.edge.from, "gen-text");
        assert.equal(waterEdge.edge.out, "water");
        assert.equal(waterEdge.edge.in, "context");
      }

      const cheeseEdge = addEdits.find(
        (e) => e.type === "addedge" && e.edge.to === "cheese"
      );
      assert.ok(cheeseEdge);
    });

    it("skips edge creation for nonexistent target nodes", async () => {
      const graph = createMockGraph({
        nodeId: "gen-text",
        outgoingEdges: [],
        knownNodeIds: ["water"],
        // "cheese" not in knownNodeIds
      });
      const { context, appliedEdits } = createMockContext(graph);

      const transform = new ChangeEdgesToRoutingMode(
        "gen-text",
        "main",
        routingConfig("water", "cheese")
      );
      await transform.apply(context);

      const edits = appliedEdits[0];
      const addEdits = edits.filter((e) => e.type === "addedge");
      assert.equal(addEdits.length, 1);
      if (addEdits[0].type === "addedge") {
        assert.equal(addEdits[0].edge.to, "water");
      }
    });

    it("does not create duplicate edges for existing targets", async () => {
      const graph = createMockGraph({
        nodeId: "gen-text",
        outgoingEdges: [makeMockEdge("gen-text", "water", "water", "context")],
        knownNodeIds: ["water", "cheese"],
      });
      const { context, appliedEdits } = createMockContext(graph);

      const transform = new ChangeEdgesToRoutingMode(
        "gen-text",
        "main",
        routingConfig("water", "cheese")
      );
      await transform.apply(context);

      const edits = appliedEdits[0];
      const addEdits = edits.filter((e) => e.type === "addedge");
      // Only cheese should be added; water already exists.
      assert.equal(addEdits.length, 1);
      if (addEdits[0].type === "addedge") {
        assert.equal(addEdits[0].edge.to, "cheese");
      }
    });
  });

  describe("edge renaming", () => {
    it("renames outgoing edge out port to target node id", async () => {
      const graph = createMockGraph({
        nodeId: "gen-text",
        outgoingEdges: [
          makeMockEdge("gen-text", "water", "context", "p-z-user-input"),
        ],
        knownNodeIds: ["water"],
      });
      const { context, appliedEdits } = createMockContext(graph);

      const transform = new ChangeEdgesToRoutingMode(
        "gen-text",
        "main",
        routingConfig("water")
      );
      await transform.apply(context);

      const edits = appliedEdits[0];
      const changeEdits = edits.filter((e) => e.type === "changeedge");
      assert.equal(changeEdits.length, 1);
      if (changeEdits[0].type === "changeedge") {
        assert.equal(changeEdits[0].to.out, "water");
      }
    });

    it("skips rename if out port already matches target", async () => {
      const graph = createMockGraph({
        nodeId: "gen-text",
        outgoingEdges: [makeMockEdge("gen-text", "water", "water", "context")],
        knownNodeIds: ["water"],
      });
      const { context, appliedEdits } = createMockContext(graph);

      const transform = new ChangeEdgesToRoutingMode(
        "gen-text",
        "main",
        routingConfig("water")
      );
      await transform.apply(context);

      const edits = appliedEdits[0];
      // No changeedge or addedge needed — everything is already correct.
      assert.equal(edits.length, 0);
    });
  });

  describe("stale edge deletion", () => {
    it("deletes edges to targets not in route list", async () => {
      const graph = createMockGraph({
        nodeId: "gen-text",
        outgoingEdges: [
          makeMockEdge("gen-text", "water", "water", "context"),
          makeMockEdge("gen-text", "cheese", "cheese", "context"),
        ],
        knownNodeIds: ["cheese"],
      });
      const { context, appliedEdits } = createMockContext(graph);

      // Only cheese is in routes now, water was removed.
      const transform = new ChangeEdgesToRoutingMode(
        "gen-text",
        "main",
        routingConfig("cheese")
      );
      await transform.apply(context);

      const edits = appliedEdits[0];
      const removeEdits = edits.filter((e) => e.type === "removeedge");
      assert.equal(removeEdits.length, 1);
      if (removeEdits[0].type === "removeedge") {
        assert.equal(removeEdits[0].edge.to, "water");
      }
    });

    it("deletes all stale edges when route targets change completely", async () => {
      const graph = createMockGraph({
        nodeId: "gen-text",
        outgoingEdges: [
          makeMockEdge("gen-text", "water", "water", "context"),
          makeMockEdge("gen-text", "old-target", "old-target", "context"),
        ],
        knownNodeIds: ["new-target-a", "new-target-b"],
      });
      const { context, appliedEdits } = createMockContext(graph);

      const transform = new ChangeEdgesToRoutingMode(
        "gen-text",
        "main",
        routingConfig("new-target-a", "new-target-b")
      );
      await transform.apply(context);

      const edits = appliedEdits[0];
      const removeEdits = edits.filter((e) => e.type === "removeedge");
      assert.equal(removeEdits.length, 2);

      const addEdits = edits.filter((e) => e.type === "addedge");
      assert.equal(addEdits.length, 2);
    });
  });
});
