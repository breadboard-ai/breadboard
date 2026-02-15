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
} from "@breadboard-ai/types";
import { DescribeResultCache } from "./describe-cache.js";

import { Graph } from "./graph.js";
import { NodeCache } from "./node-cache.js";
import { NodeDescriberManager } from "./node-describer-manager.js";
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

  addSubgraph(subgraph: GraphDescriptor, graphId: GraphIdentifier): void {
    this.nodes.addSubgraphNodes(subgraph, graphId);
  }

  removeSubgraph(graphId: GraphIdentifier): void {
    this.nodes.removeSubgraphNodes(graphId);
  }

  rebuild(graph: GraphDescriptor) {
    this.graph = graph;
    this.nodes = new NodeCache((descriptor, graphId) => {
      const graph = graphId ? this.graphs.get(graphId) : this;
      if (!graph) {
        throw new Error(
          `Inspect API Integrity error: unable to find subgraph "${graphId}"`
        );
      }
      return new Node(descriptor, this, graphId);
    });
    this.describe = new DescribeResultCache(
      new NodeDescriberManager(this, this.#deps)
    );
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
    this.nodes.rebuild(graph);
  }
}
