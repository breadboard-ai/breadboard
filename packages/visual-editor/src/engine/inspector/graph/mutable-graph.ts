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
  NodeIdentifier,
} from "@breadboard-ai/types";
import { DescribeResultCache } from "./describe-cache.js";

import { GraphCache } from "./graph-cache.js";
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
  entries!: NodeIdentifier[];

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
    this.entries = findEntries(graph);
    this.graph = graph;
  }

  addSubgraph(subgraph: GraphDescriptor, graphId: GraphIdentifier): void {
    this.graphs.add(graphId);
    this.nodes.addSubgraphNodes(subgraph, graphId);
  }

  removeSubgraph(graphId: GraphIdentifier): void {
    this.graphs.remove(graphId);
    this.nodes.removeSubgraphNodes(graphId);
  }

  rebuild(graph: GraphDescriptor) {
    this.entries = findEntries(graph);
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
    this.graphs = new GraphCache((id) => new Graph(id, this));
    this.graphs.rebuild(graph);
    this.nodes.rebuild(graph);
  }
}

function findEntries(graph: GraphDescriptor): NodeIdentifier[] {
  const incomingEdges = new Set<NodeIdentifier>();
  const outgoingEdges = new Set<NodeIdentifier>();

  for (const edge of graph.edges) {
    incomingEdges.add(edge.to);
    outgoingEdges.add(edge.from);
  }

  const entries = graph.nodes.filter((node) => !incomingEdges.has(node.id));

  if (entries.length === 0) return [];

  const standalone: NodeIdentifier[] = [];
  const connected: NodeIdentifier[] = [];
  let onlyStandalone = true;

  for (const node of entries) {
    if (outgoingEdges.has(node.id)) {
      onlyStandalone = false;
      connected.push(node.id);
    } else {
      standalone.push(node.id);
    }
  }

  if (standalone.length === 0) return entries.map((n) => n.id);

  const start = standalone.find(
    (id) => graph.nodes.find((n) => n.id === id)?.metadata?.start
  );
  if (start) return [start];

  if (onlyStandalone) return [standalone[0]];

  return connected;
}
