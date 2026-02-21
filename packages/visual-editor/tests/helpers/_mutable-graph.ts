/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AffectedNode,
  GraphDescriptor,
  GraphIdentifier,
  GraphStoreArgs,
  MutableGraph,
  MutableGraphStore,
  NodeDescriptor,
} from "@breadboard-ai/types";
import { DescribeResultCache } from "../../src/engine/inspector/graph/describe-cache.js";

import { Graph } from "../../src/engine/inspector/graph/graph.js";
import { Node } from "../../src/engine/inspector/graph/node.js";

export { createMutableGraph };

/**
 * Creates a standalone MutableGraph from a graph descriptor.
 *
 * Test-only helper that provides an InspectableGraph without a full
 * GraphController. For production initialization, use
 * `GraphController.initialize()` instead.
 */
function createMutableGraph(
  graph: GraphDescriptor,
  store: MutableGraphStore,
  deps: GraphStoreArgs
): MutableGraph {
  function graphNodes(graphId: GraphIdentifier): NodeDescriptor[] {
    if (!graphId) return mutable.graph.nodes;
    return mutable.graph.graphs?.[graphId]?.nodes || [];
  }

  function buildNodeAccessor() {
    return {
      get: (id: string, graphId: string) => {
        const descriptor = graphNodes(graphId).find((n) => n.id === id);
        return descriptor ? new Node(descriptor, mutable, graphId) : undefined;
      },
      nodes: (graphId: string) =>
        graphNodes(graphId).map((n) => new Node(n, mutable, graphId)),
      byType: (type: string, graphId: string) =>
        graphNodes(graphId)
          .filter((n) => n.type === type)
          .map((n) => new Node(n, mutable, graphId)),
    };
  }

  // Use a writable backing object, then return it typed as MutableGraph.
  // The readonly modifiers on MutableGraph are for external consumers —
  // internally we need to mutate during rebuild().
  const mutable = {
    graph,
    id: crypto.randomUUID(),
    deps,
    store,
    describe: null! as MutableGraph["describe"],
    graphs: null! as MutableGraph["graphs"],
    nodes: null! as MutableGraph["nodes"],

    update(
      graph: GraphDescriptor,
      visualOnly: boolean,
      affectedNodes: AffectedNode[]
    ): void {
      if (!visualOnly) {
        mutable.describe.update(affectedNodes);
      }
      mutable.graph = graph;
    },

    rebuild(graph: GraphDescriptor): void {
      mutable.graph = graph;
      mutable.describe = new DescribeResultCache(mutable as MutableGraph, deps);
      mutable.graphs = {
        get: (id: GraphIdentifier) => new Graph(id, mutable as MutableGraph),
        graphs: () =>
          Object.fromEntries(
            Object.keys(mutable.graph.graphs || {}).map((id) => [
              id,
              new Graph(id, mutable as MutableGraph),
            ])
          ),
      };
      mutable.nodes = buildNodeAccessor();
    },
  };

  mutable.rebuild(graph);
  return mutable as MutableGraph;
}
