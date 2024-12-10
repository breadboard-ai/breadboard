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
} from "../../types.js";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableModules,
  InspectableNode,
  InspectableNodeType,
  InspectableSubgraphs,
  MutableGraph,
} from "../types.js";
import { GraphDescriberManager } from "./describer-manager.js";
import { GraphQueries } from "./graph-queries.js";

export { Graph };

class Graph implements InspectableGraph {
  #graphId: GraphIdentifier;
  #mutable: MutableGraph;

  constructor(graphId: GraphIdentifier, mutableGraph: MutableGraph) {
    this.#graphId = graphId;
    this.#mutable = mutableGraph;
  }

  #descriptor(): GraphDescriptor {
    const graph = this.#mutable.graph;
    return this.#graphId ? graph.graphs![this.#graphId]! : graph;
  }

  raw() {
    return this.#descriptor();
  }

  mainGraphDescriptor(): GraphDescriptor {
    return this.#mutable.graph;
  }

  imperative(): boolean {
    return !!this.main();
  }

  main(): string | undefined {
    return this.#descriptor().main;
  }

  metadata(): GraphMetadata | undefined {
    return this.#descriptor().metadata;
  }

  nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.#mutable.nodes.byType(type, this.#graphId);
  }

  nodeById(id: NodeIdentifier) {
    return new GraphQueries(this.#mutable, this.#graphId).nodeById(id);
  }

  nodes(): InspectableNode[] {
    return this.#mutable.nodes.nodes(this.#graphId);
  }

  moduleById(id: ModuleIdentifier) {
    return this.#mutable.modules.get(id);
  }

  modules(): InspectableModules {
    return this.#mutable.modules.modules();
  }

  edges(): InspectableEdge[] {
    return this.#mutable.edges.edges(this.#graphId);
  }

  hasEdge(edge: Edge): boolean {
    return this.#mutable.edges.hasByValue(edge, this.#graphId);
  }

  typeForNode(id: NodeIdentifier): InspectableNodeType | undefined {
    return new GraphQueries(this.#mutable, this.#graphId).typeForNode(id);
  }

  typeById(id: NodeTypeIdentifier): InspectableNodeType | undefined {
    return new GraphQueries(this.#mutable, this.#graphId).typeById(id);
  }

  incomingForNode(id: NodeIdentifier): InspectableEdge[] {
    return new GraphQueries(this.#mutable, this.#graphId).incoming(id);
  }

  outgoingForNode(id: NodeIdentifier): InspectableEdge[] {
    return new GraphQueries(this.#mutable, this.#graphId).outgoing(id);
  }

  entries(): InspectableNode[] {
    return new GraphQueries(this.#mutable, this.#graphId).entries();
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    const manager = GraphDescriberManager.create(this.#graphId, this.#mutable);
    if (!manager.success) {
      throw new Error(`Inspect API Integrity Error: ${manager.error}`);
    }
    return manager.result.describe(inputs);
  }

  graphs(): InspectableSubgraphs | undefined {
    if (this.#graphId) return;
    return this.#mutable.graphs.graphs();
  }

  graphId(): GraphIdentifier {
    return this.#graphId;
  }
}
