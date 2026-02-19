/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared mock utilities for edge transform tests. These provide minimal
 * implementations of the interfaces the transforms depend on, typed precisely
 * to avoid `as any` in test code.
 */

import { mock } from "node:test";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
} from "@breadboard-ai/types/edit.js";
import type { Edge } from "@breadboard-ai/types/graph-descriptor.js";

export { createMockGraph, createMockContext, makeMockEdge, routingConfig };

/**
 * Minimal shape of an inspectable edge, matching what the transforms use:
 * `edge.raw()` and `edge.to.descriptor.id`.
 */
type MockEdge = {
  raw: () => Edge;
  to: { descriptor: { id: string } };
};

/**
 * Minimal shape of an inspectable node, matching what the transforms use:
 * `outgoing()` and `descriptor.id`.
 */
type MockNode = {
  outgoing: () => MockEdge[];
  descriptor: { id: string };
};

/**
 * Minimal shape for nodeById return — some callers only need `descriptor.id`,
 * while the primary node also needs `outgoing()`.
 */
type MockNodeRef = { descriptor: { id: string } };

/**
 * Minimal shape of an inspectable graph, matching what the transforms use:
 * `nodeById(id)`.
 */
type MockGraph = {
  nodeById: (id: string) => MockNode | MockNodeRef | null;
};

/**
 * Creates a minimal mock graph for edge transform tests.
 */
function createMockGraph(opts: {
  nodeId: string;
  outgoingEdges: MockEdge[];
  knownNodeIds?: string[];
}): MockGraph {
  const knownNodeIds = new Set(opts.knownNodeIds ?? []);
  const node: MockNode = {
    outgoing: () => opts.outgoingEdges,
    descriptor: { id: opts.nodeId },
  };

  return {
    nodeById: (id: string): MockNode | MockNodeRef | null => {
      if (id === opts.nodeId) return node;
      if (knownNodeIds.has(id)) return { descriptor: { id } };
      return null;
    },
  };
}

/**
 * Creates a mock EditOperationContext that captures the EditSpec arrays
 * passed to `context.apply(...)`. The `appliedEdits` array accumulates
 * each call's specs for assertion.
 */
function createMockContext(
  graph: MockGraph,
  graphId = "main"
): { context: EditOperationContext; appliedEdits: EditSpec[][] } {
  const appliedEdits: EditSpec[][] = [];

  // Build a minimal mutable with a Map<string, MockGraph> that satisfies
  // the `context.mutable.graphs.get(graphId)` call path.
  const graphs = new Map<string, MockGraph>([[graphId, graph]]);

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

function makeMockEdge(
  from: string,
  to: string,
  out: string,
  inp: string
): MockEdge {
  const edge: Edge = { from, to, out, in: inp };
  return {
    raw: () => edge,
    to: { descriptor: { id: to } },
  };
}

/**
 * Creates a node configuration with routing chiclets pointing to targets.
 */
function routingConfig(...targetIds: string[]) {
  const chiclets = targetIds
    .map(
      (id) =>
        `{{"type":"tool","path":"control-flow/routing","instance":"${id}","title":"Target"}}`
    )
    .join("\n");
  return {
    config$prompt: {
      role: "user",
      parts: [{ text: `Route to:\n${chiclets}` }],
    },
  };
}
