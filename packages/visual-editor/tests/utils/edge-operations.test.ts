/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Edge } from "@breadboard-ai/types/graph-descriptor.js";
import {
  computeEdgeDiff,
  dedupeEdges,
} from "../../src/utils/edge-operations.js";

describe("edge-operations", () => {
  const edge = (
    from: string,
    out: string,
    to: string,
    inPort: string
  ): Edge => ({ from, out, to, in: inPort });

  describe("dedupeEdges", () => {
    it("removes duplicate edges", () => {
      const edges: Edge[] = [
        edge("a", "x", "b", "y"),
        edge("a", "x", "b", "y"), // duplicate
        edge("c", "x", "d", "y"),
      ];
      const result = dedupeEdges(edges);
      assert.equal(result.length, 2);
    });

    it("keeps edges that differ in any field", () => {
      const edges: Edge[] = [
        edge("a", "x", "b", "y"),
        edge("a", "x", "b", "z"), // different in port
      ];
      const result = dedupeEdges(edges);
      assert.equal(result.length, 2);
    });

    it("handles empty array", () => {
      assert.deepEqual(dedupeEdges([]), []);
    });

    it("ignores metadata when deduping", () => {
      const edges: Edge[] = [
        { ...edge("a", "x", "b", "y"), metadata: { visual: {} } },
        { ...edge("a", "x", "b", "y"), metadata: { visual: { x: 1 } } },
      ];
      const result = dedupeEdges(edges);
      // metadata is stripped from the key, so these are duplicates
      assert.equal(result.length, 1);
    });
  });

  describe("computeEdgeDiff", () => {
    it("identifies edges to insert", () => {
      const current: Edge[] = [edge("a", "x", "b", "y")];
      const incoming: Edge[] = [
        edge("a", "x", "b", "y"),
        edge("c", "x", "d", "y"),
      ];
      const { toInsert, toDelete } = computeEdgeDiff(current, incoming);
      assert.equal(toInsert.length, 1);
      assert.equal(toInsert[0].from, "c");
      assert.equal(toDelete.length, 0);
    });

    it("identifies edges to delete", () => {
      const current: Edge[] = [
        edge("a", "x", "b", "y"),
        edge("c", "x", "d", "y"),
      ];
      const incoming: Edge[] = [edge("a", "x", "b", "y")];
      const { toInsert, toDelete } = computeEdgeDiff(current, incoming);
      assert.equal(toInsert.length, 0);
      assert.equal(toDelete.length, 1);
      assert.equal(toDelete[0].from, "c");
    });

    it("handles identical sets", () => {
      const edges: Edge[] = [edge("a", "x", "b", "y")];
      const { toInsert, toDelete } = computeEdgeDiff(edges, edges);
      assert.equal(toInsert.length, 0);
      assert.equal(toDelete.length, 0);
    });

    it("handles both empty", () => {
      const { toInsert, toDelete } = computeEdgeDiff([], []);
      assert.equal(toInsert.length, 0);
      assert.equal(toDelete.length, 0);
    });

    it("handles complete replacement", () => {
      const current: Edge[] = [edge("a", "x", "b", "y")];
      const incoming: Edge[] = [edge("c", "x", "d", "y")];
      const { toInsert, toDelete } = computeEdgeDiff(current, incoming);
      assert.equal(toInsert.length, 1);
      assert.equal(toDelete.length, 1);
    });
  });
});
