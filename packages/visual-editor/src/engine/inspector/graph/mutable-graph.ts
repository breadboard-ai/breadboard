/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphRepresentationImpl } from "@breadboard-ai/runtime/legacy.js";
import type {
  AffectedNode,
  GraphDescriptor,
  GraphIdentifier,
  GraphRepresentation,
  InspectableDescriberResultCache,
  InspectableEdgeCache,
  InspectableGraphCache,
  InspectableKitCache,
  InspectableModuleCache,
  InspectableNodeCache,
  InspectablePortCache,
  KitDescriptor,
  MainGraphIdentifier,
  ModuleIdentifier,
  MutableGraph,
  MutableGraphStore,
} from "@breadboard-ai/types";
import { isImperativeGraph, toDeclarativeGraph } from "@breadboard-ai/utils";
import { DescribeResultCache } from "./describe-cache.js";
import { EdgeCache } from "./edge-cache.js";
import { Edge } from "./edge.js";
import { UpdateEvent } from "./event.js";
import { GraphCache } from "./graph-cache.js";
import { Graph } from "./graph.js";
import { KitCache } from "./kits.js";
import { ModuleCache } from "./module.js";
import { NodeCache } from "./node-cache.js";
import { NodeDescriberManager } from "./node-describer-manager.js";
import { Node } from "./node.js";
import { PortCache } from "./port-cache.js";

export { MutableGraphImpl };

class MutableGraphImpl implements MutableGraph {
  readonly store: MutableGraphStore;
  readonly id: MainGraphIdentifier;

  legacyKitMetadata: KitDescriptor | null = null;

  graph!: GraphDescriptor;
  graphs!: InspectableGraphCache;
  nodes!: InspectableNodeCache;
  edges!: InspectableEdgeCache;
  modules!: InspectableModuleCache;
  describe!: InspectableDescriberResultCache;
  kits!: InspectableKitCache;
  ports!: InspectablePortCache;
  representation!: GraphRepresentation;

  constructor(graph: GraphDescriptor, store: MutableGraphStore) {
    this.store = store;
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
    this.representation = new GraphRepresentationImpl(graph);
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
    if (isImperativeGraph(graph)) {
      graph = toDeclarativeGraph(graph);
    }
    this.representation = new GraphRepresentationImpl(graph);
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
      (edge, graphId) => new Edge(this, edge, graphId)
    );
    this.modules = new ModuleCache();
    this.describe = new DescribeResultCache(new NodeDescriberManager(this));
    this.kits = new KitCache(this);
    this.graphs = new GraphCache((id) => new Graph(id, this));
    this.ports = new PortCache();
    this.graphs.rebuild(graph);
    this.nodes.rebuild(graph);
    this.edges.rebuild(graph);
    this.modules.rebuild(graph);
    this.kits.rebuild(graph);
  }
}
