/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MoveNodesToGraph } from "../../../src/ui/transforms/move-nodes-to-graph.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
} from "@breadboard-ai/types";

function createMockContext(opts: {
  nodes: {
    id: string;
    type: string;
    metadata?: Record<string, unknown>;
    configuration?: Record<string, unknown>;
  }[];
  edges?: { from: string; to: string; out: string; in: string }[];
  graphId?: string;
  destGraphExists?: boolean;
}) {
  const appliedEdits: EditSpec[][] = [];
  const graphId = opts.graphId ?? "main";

  const inspectableNodes = opts.nodes.map((n) => ({
    descriptor: {
      id: n.id,
      type: n.type,
      metadata: n.metadata ?? {},
      configuration: n.configuration ?? {},
    },
  }));

  const inspectableEdges = (opts.edges ?? []).map((e) => ({
    from: { descriptor: { id: e.from } },
    to: { descriptor: { id: e.to } },
    raw: () => ({ ...e }),
  }));

  const inspectable = {
    nodeById: (id: string) =>
      inspectableNodes.find((n) => n.descriptor.id === id) ?? null,
    nodes: () => inspectableNodes,
    edges: () => inspectableEdges,
  };

  const graphs = new Map<string, unknown>([[graphId, inspectable]]);
  if (opts.destGraphExists) {
    graphs.set("dest-graph", inspectable);
  }

  const context = {
    graph: { nodes: [], edges: [] },
    mutable: { graphs },
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits };
}

describe("MoveNodesToGraph", () => {
  // Override crypto.randomUUID for deterministic tests

  beforeEach(() => {
    let counter = 0;
    mock.method(globalThis.crypto, "randomUUID", () => {
      counter++;
      return `uuid-${counter}`;
    });
  });

  it("fails if source graph not found", async () => {
    const { context } = createMockContext({
      nodes: [],
      graphId: "other",
    });

    const transform = new MoveNodesToGraph(["node-1"], "missing");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing"));
    }
    mock.restoreAll();
  });

  it("creates destination graph when it does not exist", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", type: "my-type" }],
      graphId: "main",
    });

    const transform = new MoveNodesToGraph(["node-1"], "main", "new-sub");
    await transform.apply(context);

    const edits = appliedEdits[0];
    const addGraph = edits.find((e) => e.type === "addgraph");
    assert.ok(addGraph, "should create the destination graph");
    mock.restoreAll();
  });

  it("does not create destination graph when it already exists", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", type: "my-type" }],
      graphId: "main",
      destGraphExists: true,
    });

    const transform = new MoveNodesToGraph(["node-1"], "main", "dest-graph");
    await transform.apply(context);

    const edits = appliedEdits[0];
    const addGraph = edits.find((e) => e.type === "addgraph");
    assert.equal(addGraph, undefined, "should not create existing graph");
    mock.restoreAll();
  });

  it("adds nodes with new IDs and removes old ones", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        { id: "node-1", type: "my-type" },
        { id: "node-2", type: "other-type" },
      ],
      graphId: "main",
      destGraphExists: true,
    });

    const transform = new MoveNodesToGraph(
      ["node-1", "node-2"],
      "main",
      "dest-graph"
    );
    await transform.apply(context);

    const edits = appliedEdits[0];
    const addNodes = edits.filter((e) => e.type === "addnode");
    const removeNodes = edits.filter((e) => e.type === "removenode");
    assert.equal(addNodes.length, 2);
    assert.equal(removeNodes.length, 2);

    // New IDs should be UUIDs, not the originals
    if (addNodes[0].type === "addnode") {
      assert.notEqual(addNodes[0].node.id, "node-1");
    }
    mock.restoreAll();
  });

  it("recreates edges between moved nodes with remapped IDs", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        { id: "node-1", type: "type-a" },
        { id: "node-2", type: "type-b" },
      ],
      edges: [{ from: "node-1", to: "node-2", out: "output", in: "input" }],
      graphId: "main",
      destGraphExists: true,
    });

    const transform = new MoveNodesToGraph(
      ["node-1", "node-2"],
      "main",
      "dest-graph"
    );
    await transform.apply(context);

    const edits = appliedEdits[0];
    const addEdges = edits.filter((e) => e.type === "addedge");
    assert.equal(addEdges.length, 1, "should recreate the edge");

    // Edge should use remapped IDs
    if (addEdges[0].type === "addedge") {
      assert.notEqual(addEdges[0].edge.from, "node-1");
      assert.notEqual(addEdges[0].edge.to, "node-2");
    }
    mock.restoreAll();
  });

  it("skips edges where only one end is moved", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        { id: "node-1", type: "type-a" },
        { id: "node-2", type: "type-b" },
      ],
      edges: [{ from: "node-1", to: "node-2", out: "output", in: "input" }],
      graphId: "main",
      destGraphExists: true,
    });

    // Only move node-1, not node-2
    const transform = new MoveNodesToGraph(["node-1"], "main", "dest-graph");
    await transform.apply(context);

    const edits = appliedEdits[0];
    const addEdges = edits.filter((e) => e.type === "addedge");
    assert.equal(addEdges.length, 0, "should skip edge with unmoved end");
    mock.restoreAll();
  });

  it("removes source subgraph when all nodes are moved", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", type: "my-type" }],
      graphId: "sub-graph",
      destGraphExists: true,
    });

    const transform = new MoveNodesToGraph(
      ["node-1"],
      "sub-graph",
      "dest-graph"
    );
    await transform.apply(context);

    const edits = appliedEdits[0];
    const removeGraph = edits.find((e) => e.type === "removegraph");
    assert.ok(removeGraph, "should remove empty subgraph");
    mock.restoreAll();
  });

  it("does not remove main graph even when all nodes are moved", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", type: "my-type" }],
      graphId: "",
      destGraphExists: true,
    });

    // graphId "" is the main graph
    const transform = new MoveNodesToGraph(["node-1"], "", "dest-graph");
    await transform.apply(context);

    const edits = appliedEdits[0];
    const removeGraph = edits.find((e) => e.type === "removegraph");
    assert.equal(removeGraph, undefined, "should not remove main graph");
    mock.restoreAll();
  });

  it("applies position delta to moved nodes", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "node-1",
          type: "my-type",
          metadata: { visual: { x: 100, y: 200 } },
        },
      ],
      graphId: "main",
      destGraphExists: true,
    });

    const delta = { x: 50, y: -30, z: 0, w: 1 } as DOMPoint;
    const transform = new MoveNodesToGraph(
      ["node-1"],
      "main",
      "dest-graph",
      delta
    );
    await transform.apply(context);

    const edits = appliedEdits[0];
    const addNode = edits.find((e) => e.type === "addnode");
    if (addNode?.type === "addnode") {
      const visual = addNode.node.metadata?.visual as Record<string, number>;
      assert.equal(visual.x, 150);
      assert.equal(visual.y, 170);
    }
    mock.restoreAll();
  });

  it("skips nodes that don't exist in the source graph", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", type: "my-type" }],
      graphId: "main",
      destGraphExists: true,
    });

    const transform = new MoveNodesToGraph(
      ["node-1", "nonexistent"],
      "main",
      "dest-graph"
    );
    await transform.apply(context);

    const edits = appliedEdits[0];
    const addNodes = edits.filter((e) => e.type === "addnode");
    assert.equal(addNodes.length, 1, "should only add existing nodes");
    mock.restoreAll();
  });
});
