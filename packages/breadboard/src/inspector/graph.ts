/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  GraphMetadata,
  InputValues,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import {
  Edge,
  GraphDescriptor,
  NodeDescriberResult,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "../types.js";
import {
  InspectableEdge,
  InspectableGraphWithStore,
  InspectableKit,
  InspectableModules,
  InspectableNode,
  InspectableNodeType,
  InspectableSubgraphs,
  MutableGraph,
  NodeTypeDescriberOptions,
} from "./types.js";
import { AffectedNode } from "../editor/types.js";
import { DescriberManager } from "./describer-manager.js";
import { GraphDescriptorHandle } from "./graph-descriptor-handle.js";
import { GraphQueries } from "./graph-queries.js";

export { Graph };

class Graph implements InspectableGraphWithStore {
  #graphId: GraphIdentifier;
  #cache: MutableGraph;

  #imperativeMain: ModuleIdentifier | undefined;

  constructor(
    graph: GraphDescriptor,
    graphId: GraphIdentifier,
    mutableGraph: MutableGraph
  ) {
    this.#graphId = graphId;
    if (graphId && !mutableGraph) {
      throw new Error(
        `Inspect API integrity error: parent cache not supplied to a sub-graph.`
      );
    }
    const handle = GraphDescriptorHandle.create(graph, graphId);
    if (!handle.success) {
      throw new Error(`Inspect API integrity error: ${handle.error}`);
    }
    this.#imperativeMain = handle.result.main();
    this.#cache = mutableGraph;
  }

  #graph(): GraphDescriptor {
    const graph = this.#cache.graph;
    return this.#graphId ? graph.graphs![this.#graphId]! : graph;
  }

  raw() {
    return this.#graph();
  }

  imperative(): boolean {
    return !!this.#imperativeMain;
  }

  main(): string | undefined {
    return this.#imperativeMain;
  }

  metadata(): GraphMetadata | undefined {
    return this.#graph().metadata;
  }

  nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.#cache.nodes.byType(type, this.#graphId);
  }

  async describeNodeType(
    id: NodeIdentifier,
    type: NodeTypeIdentifier,
    options: NodeTypeDescriberOptions = {}
  ): Promise<NodeDescriberResult> {
    const manager = DescriberManager.create(this.#graphId, this.#cache);
    if (!manager.success) {
      throw new Error(`Inspect API Integrity Error: ${manager.error}`);
    }
    return manager.result.describeNodeType(id, type, options);
  }

  nodeById(id: NodeIdentifier) {
    return new GraphQueries(this.#cache, this.#graphId).nodeById(id);
  }

  nodes(): InspectableNode[] {
    return this.#cache.nodes.nodes(this.#graphId);
  }

  moduleById(id: ModuleIdentifier) {
    return this.#cache.modules.get(id);
  }

  modules(): InspectableModules {
    return this.#cache.modules.modules();
  }

  edges(): InspectableEdge[] {
    return this.#cache.edges.edges(this.#graphId);
  }

  hasEdge(edge: Edge): boolean {
    return this.#cache.edges.hasByValue(edge, this.#graphId);
  }

  kits(): InspectableKit[] {
    return this.#cache.kits.kits();
  }

  typeForNode(id: NodeIdentifier): InspectableNodeType | undefined {
    return new GraphQueries(this.#cache, this.#graphId).typeForNode(id);
  }

  typeById(id: NodeTypeIdentifier): InspectableNodeType | undefined {
    return new GraphQueries(this.#cache, this.#graphId).typeById(id);
  }

  incomingForNode(id: NodeIdentifier): InspectableEdge[] {
    return new GraphQueries(this.#cache, this.#graphId).incoming(id);
  }

  outgoingForNode(id: NodeIdentifier): InspectableEdge[] {
    return new GraphQueries(this.#cache, this.#graphId).outgoing(id);
  }

  entries(): InspectableNode[] {
    return new GraphQueries(this.#cache, this.#graphId).entries();
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    const manager = DescriberManager.create(this.#graphId, this.#cache);
    if (!manager.success) {
      throw new Error(`Inspect API Integrity Error: ${manager.error}`);
    }
    return manager.result.describe(inputs);
  }

  get nodeStore() {
    return this.#cache.nodes;
  }

  get edgeStore() {
    return this.#cache.edges;
  }

  get moduleStore() {
    return this.#cache.modules;
  }

  updateGraph(
    graph: GraphDescriptor,
    visualOnly: boolean,
    affectedNodes: AffectedNode[],
    affectedModules: ModuleIdentifier[]
  ): void {
    if (this.#graphId) {
      throw new Error(
        "Inspect API integrity error: updateGraph should never be called for subgraphs"
      );
    }
    // TODO: Handle this a better way?
    for (const id of affectedModules) {
      this.#cache.modules.remove(id);
      if (!graph.modules || !graph.modules[id]) {
        continue;
      }

      this.#cache.modules.add(id, graph.modules[id]);

      // Find any nodes configured to use this module and clear its describer.
      const runModulesNodes = this.#cache.nodes.byType(
        "runModule",
        this.#graphId
      );
      for (const node of runModulesNodes) {
        if (
          node.configuration().$module &&
          node.configuration().$module === id &&
          !affectedNodes.find((n) => n.id === node.descriptor.id)
        ) {
          affectedNodes.push({
            id: node.descriptor.id,
            graphId: this.#graphId,
          });
          visualOnly = false;
        }
      }
    }

    this.#cache.describe.clear(visualOnly, affectedNodes);
    this.#cache.graph = graph;
    this.#cache.graphs.rebuild(graph);
  }

  resetGraph(graph: GraphDescriptor): void {
    if (this.#graphId) {
      throw new Error(
        "Inspect API integrity error: resetSubgraph should never be called for subgraphs"
      );
    }
    this.#cache.rebuild(graph);
  }

  addSubgraph(subgraph: GraphDescriptor, graphId: GraphIdentifier): void {
    if (this.#graphId) {
      throw new Error(
        `Can't add subgraph "${graphId}" to subgraph "${this.#graphId}": subgraphs can't contain subgraphs`
      );
    }
    this.#cache.graphs.add(
      graphId,
      new Graph(this.#cache.graph, graphId, this.#cache)
    );
    this.#cache.nodes.addSubgraphNodes(subgraph, graphId);
    this.#cache.edges.addSubgraphEdges(subgraph, graphId);
  }

  removeSubgraph(graphId: GraphIdentifier): void {
    if (this.#graphId) {
      throw new Error(
        `Can't remove subgraph "${graphId}" from subgraph "${this.#graphId}": subgraphs can't contain subgraphs`
      );
    }
    this.#cache.graphs.remove(graphId);
    this.#cache.nodes.removeSubgraphNodes(graphId);
    this.#cache.edges.removeSubgraphEdges(graphId);
  }

  graphs(): InspectableSubgraphs | undefined {
    if (this.#graphId) return;
    return this.#cache.graphs.graphs();
  }

  graphId(): GraphIdentifier {
    return this.#graphId;
  }
}
