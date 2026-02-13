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
  InspectableEdgeCache,
  InspectableGraphCache,
  InspectableModuleCache,
  InspectableNodeCache,
  InspectablePortCache,
  KitDescriptor,
  MainGraphIdentifier,
  ModuleIdentifier,
  MutableGraph,
  MutableGraphStore,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { DescribeResultCache } from "./describe-cache.js";
import { EdgeCache } from "./edge-cache.js";
import { Edge as InspectableEdge } from "./edge.js";
import { UpdateEvent } from "./event.js";
import { GraphCache } from "./graph-cache.js";
import { Graph } from "./graph.js";
import { ModuleCache } from "./module.js";
import { NodeCache } from "./node-cache.js";
import { NodeDescriberManager } from "./node-describer-manager.js";
import { Node } from "./node.js";
import { PortCache } from "./port-cache.js";

export { MutableGraphImpl };

class MutableGraphImpl implements MutableGraph {
  readonly store: MutableGraphStore;
  readonly id: MainGraphIdentifier;
  readonly #deps: GraphStoreArgs;

  legacyKitMetadata: KitDescriptor | null = null;

  graph!: GraphDescriptor;
  graphs!: InspectableGraphCache;
  nodes!: InspectableNodeCache;
  edges!: InspectableEdgeCache;
  modules!: InspectableModuleCache;
  describe!: InspectableDescriberResultCache;
  ports!: InspectablePortCache;
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
    affectedNodes: AffectedNode[],
    affectedModules: ModuleIdentifier[],
    topologyChange: boolean
  ): void {
    // TODO: Handle this a better way?
    for (const id of affectedModules) {
      this.modules.remove(id);
      if (!graph.modules || !graph.modules[id]) {
        continue;
      }

      this.modules.add(id, graph.modules[id]);

      // Find any nodes configured to use this module and clear its describer.
      const runModulesNodes = this.nodes.byType("runModule", "");
      for (const node of runModulesNodes) {
        if (
          node.configuration().$module &&
          node.configuration().$module === id &&
          !affectedNodes.find((n) => n.id === node.descriptor.id)
        ) {
          affectedNodes.push({
            id: node.descriptor.id,
            graphId: "",
          });
          visualOnly = false;
        }
      }
    }

    // TODO: Handle removals, etc.
    if (!visualOnly) {
      this.describe.update(affectedNodes);
      this.store.dispatchEvent(
        new UpdateEvent(this.id, "", "", [], topologyChange)
      );
    }
    this.entries = findEntries(graph);
    this.graph = graph;
  }

  addSubgraph(subgraph: GraphDescriptor, graphId: GraphIdentifier): void {
    this.graphs.add(graphId);
    this.nodes.addSubgraphNodes(subgraph, graphId);
    this.edges.addSubgraphEdges(subgraph, graphId);
  }

  removeSubgraph(graphId: GraphIdentifier): void {
    this.graphs.remove(graphId);
    this.nodes.removeSubgraphNodes(graphId);
    this.edges.removeSubgraphEdges(graphId);
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
    this.edges = new EdgeCache(
      (edge, graphId) => new InspectableEdge(this, edge, graphId)
    );
    this.modules = new ModuleCache();
    this.describe = new DescribeResultCache(
      new NodeDescriberManager(this, this.#deps)
    );
    this.graphs = new GraphCache((id) => new Graph(id, this));
    this.ports = new PortCache();
    this.graphs.rebuild(graph);
    this.nodes.rebuild(graph);
    this.edges.rebuild(graph);
    this.modules.rebuild(graph);
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
