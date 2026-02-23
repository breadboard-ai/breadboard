/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computePositions } from "../../src/a2/agent/graph-editing/layout-graph.js";
import type { Edge, NodeDescriptor } from "@breadboard-ai/types";

/**
 * Dawn Patrol — Inaugural Session, Feb 23 2026
 * Specimen: "The Silent Stacking"
 *
 * computePositions uses Kahn's algorithm (topological sort) to assign
 * x/y coordinates to graph nodes. This works perfectly for DAGs but
 * silently mishandles cycles: nodes in a cycle never reach in-degree 0,
 * so they're never dequeued and their depth stays at the initial value
 * of 0. The result is that cyclic nodes all stack at x=0, overlapping
 * with the true root nodes.
 */

/** Helper: build a minimal NodeDescriptor from an id. */
function node(id: string): NodeDescriptor {
  return { id, type: "test" };
}

/** Helper: build an Edge. */
function edge(from: string, to: string): Edge {
  return { from, to, in: "in", out: "out" };
}

describe("computePositions", () => {
  it("lays out a simple chain A → B → C", () => {
    const nodes = [node("A"), node("B"), node("C")];
    const edges = [edge("A", "B"), edge("B", "C")];

    const positions = computePositions(nodes, edges);

    assert.equal(positions.size, 3);
    // A at depth 0, B at depth 1, C at depth 2
    assert.equal(positions.get("A")!.x, 0);
    assert.equal(positions.get("B")!.x, 400);
    assert.equal(positions.get("C")!.x, 800);
  });

  it("lays out a diamond DAG correctly", () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D
    const nodes = [node("A"), node("B"), node("C"), node("D")];
    const edges = [
      edge("A", "B"),
      edge("A", "C"),
      edge("B", "D"),
      edge("C", "D"),
    ];

    const positions = computePositions(nodes, edges);

    assert.equal(positions.get("A")!.x, 0); // depth 0
    assert.equal(positions.get("B")!.x, 400); // depth 1
    assert.equal(positions.get("C")!.x, 400); // depth 1
    assert.equal(positions.get("D")!.x, 800); // depth 2
  });

  it("centers multiple nodes at the same depth vertically", () => {
    // A → B, A → C (B and C are siblings at depth 1)
    const nodes = [node("A"), node("B"), node("C")];
    const edges = [edge("A", "B"), edge("A", "C")];

    const positions = computePositions(nodes, edges);

    const bY = positions.get("B")!.y;
    const cY = positions.get("C")!.y;

    // They should be 200px apart and centered around y=0
    assert.equal(bY, -100);
    assert.equal(cY, 100);
  });

  it("handles disconnected nodes (no edges)", () => {
    const nodes = [node("A"), node("B")];
    const edges: Edge[] = [];

    const positions = computePositions(nodes, edges);

    // Both are roots at depth 0, stacked vertically
    assert.equal(positions.get("A")!.x, 0);
    assert.equal(positions.get("B")!.x, 0);
    assert.equal(positions.size, 2);
  });

  // =========================================================================
  // THE BUG: The Silent Stacking
  // =========================================================================
  // Nodes in a cycle never reach in-degree 0 in Kahn's algorithm so they
  // are never visited. Their depth stays at the initialized value of 0,
  // causing them to stack silently on top of the root nodes.
  //
  // While the normal UI prevents cycles via willCreateCycle(), the
  // graph-editing agent applies raw EditSpec[] that bypass this check.
  // =========================================================================

  it("BUG: cycle causes partial depth propagation", () => {
    // A → B → C → B (cycle between B and C)
    const nodes = [node("A"), node("B"), node("C")];
    const edges = [edge("A", "B"), edge("B", "C"), edge("C", "B")];

    const positions = computePositions(nodes, edges);

    // A is a root at depth 0 — correct.
    assert.equal(positions.get("A")!.x, 0);

    // B gets depth 1 because depth relaxation happens during A's
    // processing of its children, even though B is never enqueued
    // (its in-degree only drops from 2 to 1, never reaches 0).
    assert.equal(positions.get("B")!.x, 400);

    // BUG: C stays at depth 0 because B is never dequeued (due to the
    // cycle keeping its in-degree at 1), so B's children are never
    // visited. C silently overlaps with A at x=0.
    assert.equal(
      positions.get("C")!.x,
      0,
      "C is stuck at depth 0 because B (its parent) is in a cycle " +
        "and never dequeued — this is The Silent Stacking"
    );
  });

  it("BUG: nodes downstream of a cycle are also orphaned", () => {
    // A → B → C → B (cycle), C → D (D depends on a cyclic node)
    const nodes = [node("A"), node("B"), node("C"), node("D")];
    const edges = [
      edge("A", "B"),
      edge("B", "C"),
      edge("C", "B"),
      edge("C", "D"),
    ];

    const positions = computePositions(nodes, edges);

    // D depends on C which is in a cycle, so D is also never visited.
    // It stays at depth 0 alongside A, B, and C.
    assert.equal(
      positions.get("D")!.x,
      0,
      "D is orphaned because its parent C is in a cycle — this is the bug"
    );
  });
});
