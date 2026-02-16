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
  InspectableDescriberResultCache,
  InspectableGraphCache,
  InspectableNodeCache,
  MainGraphIdentifier,
  MutableGraph,
  MutableGraphStore,
  NodeDescriptor,
} from "@breadboard-ai/types";
import { DescribeResultCache } from "./describe-cache.js";

import { Graph } from "./graph.js";
import { Node } from "./node.js";

export { MutableGraphImpl };

class MutableGraphImpl implements MutableGraph {
  readonly store: MutableGraphStore;
  readonly id: MainGraphIdentifier;
  readonly #deps: GraphStoreArgs;

  get deps(): GraphStoreArgs {
    return this.#deps;
  }

  graph!: GraphDescriptor;
  graphs!: InspectableGraphCache;
  nodes!: InspectableNodeCache;
  describe!: InspectableDescriberResultCache;

  constructor(
    graph: GraphDescriptor,
    store: MutableGraphStore,
    deps: GraphStoreArgs
  ) {
    this.store = store;
    this.#deps = deps;
    this.id = crypto.randomUUID();
    this.rebuild(graph);
  }

  update(
    graph: GraphDescriptor,
    visualOnly: boolean,
    affectedNodes: AffectedNode[]
  ): void {
    // TODO: Handle removals, etc.
    if (!visualOnly) {
      this.describe.update(affectedNodes);
    }
    this.graph = graph;
  }

  rebuild(graph: GraphDescriptor) {
    this.graph = graph;
    this.describe = new DescribeResultCache(this, this.#deps);
    this.graphs = {
      get: (id: GraphIdentifier) => new Graph(id, this),
      graphs: () =>
        Object.fromEntries(
          Object.keys(this.graph.graphs || {}).map((id) => [
            id,
            new Graph(id, this),
          ])
        ),
    };
    this.nodes = this.#createNodeAccessor();
  }

  #graphNodes(graphId: GraphIdentifier): NodeDescriptor[] {
    if (!graphId) return this.graph.nodes;
    return this.graph.graphs?.[graphId]?.nodes || [];
  }

  #createNodeAccessor(): InspectableNodeCache {
    return {
      get: (id, graphId) => {
        const descriptor = this.#graphNodes(graphId).find((n) => n.id === id);
        return descriptor ? new Node(descriptor, this, graphId) : undefined;
      },
      nodes: (graphId) =>
        this.#graphNodes(graphId).map((n) => new Node(n, this, graphId)),
      byType: (type, graphId) =>
        this.#graphNodes(graphId)
          .filter((n) => n.type === type)
          .map((n) => new Node(n, this, graphId)),
    };
  }
}
