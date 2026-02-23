/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyGraphSelectionState,
  createEmptyWorkspaceSelectionState,
  createEmptyGraphHighlightState,
  createWorkspaceSelectionChangeId,
  createGraphId,
  createNodeId,
  edgeToString,
  inspectableEdgeToString,
} from "../../src/utils/graph-utils.js";

describe("graph-utils — selection factories", () => {
  describe("createEmptyGraphSelectionState", () => {
    it("creates state with empty sets", () => {
      const state = createEmptyGraphSelectionState();
      assert.equal(state.nodes.size, 0);
      assert.equal(state.assets.size, 0);
      assert.equal(state.assetEdges.size, 0);
      assert.equal(state.comments.size, 0);
      assert.equal(state.edges.size, 0);
      assert.equal(state.references.size, 0);
    });

    it("returns a new object each call", () => {
      const a = createEmptyGraphSelectionState();
      const b = createEmptyGraphSelectionState();
      assert.notEqual(a, b);
      assert.notEqual(a.nodes, b.nodes);
    });
  });

  describe("createEmptyWorkspaceSelectionState", () => {
    it("creates state with empty graphs map", () => {
      const state = createEmptyWorkspaceSelectionState();
      assert.equal(state.graphs.size, 0);
    });

    it("returns a new object each call", () => {
      const a = createEmptyWorkspaceSelectionState();
      const b = createEmptyWorkspaceSelectionState();
      assert.notEqual(a, b);
    });
  });

  describe("createEmptyGraphHighlightState", () => {
    it("creates state with empty sets", () => {
      const state = createEmptyGraphHighlightState();
      assert.equal(state.nodes.size, 0);
      assert.equal(state.comments.size, 0);
      assert.equal(state.edges.size, 0);
    });

    it("returns a new object each call", () => {
      const a = createEmptyGraphHighlightState();
      const b = createEmptyGraphHighlightState();
      assert.notEqual(a, b);
    });
  });

  describe("createWorkspaceSelectionChangeId", () => {
    it("returns a UUID string", () => {
      const id = createWorkspaceSelectionChangeId();
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("returns unique IDs", () => {
      const a = createWorkspaceSelectionChangeId();
      const b = createWorkspaceSelectionChangeId();
      assert.notEqual(a, b);
    });
  });

  describe("createGraphId", () => {
    it("returns a UUID string", () => {
      const id = createGraphId();
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe("createNodeId", () => {
    it("returns a UUID string", () => {
      const id = createNodeId();
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });
});

import type { InspectableEdge } from "@breadboard-ai/types";

describe("graph-utils — edge string conversion", () => {
  describe("edgeToString", () => {
    it("formats a normal edge", () => {
      const result = edgeToString({
        from: "nodeA",
        out: "output",
        to: "nodeB",
        in: "input",
      });
      assert.equal(result, "nodeA:output->nodeB:input");
    });

    it("handles wildcard edges", () => {
      const result = edgeToString({
        from: "nodeA",
        out: "*",
        to: "nodeB",
        in: "input",
      });
      // When out is "*", in should also become "*"
      assert.equal(result, "nodeA:*->nodeB:*");
    });
  });

  describe("inspectableEdgeToString", () => {
    it("delegates to edgeToString via raw()", () => {
      const mockEdge: Pick<InspectableEdge, "raw"> = {
        raw: () => ({
          from: "a",
          out: "x",
          to: "b",
          in: "y",
        }),
      };
      const result = inspectableEdgeToString(
        mockEdge as unknown as InspectableEdge
      );
      assert.equal(result, "a:x->b:y");
    });
  });
});
