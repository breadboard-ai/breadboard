/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  GraphIdentifier,
  GraphMetadata,
  ImportIdentifier,
  InputValues,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import { Outcome } from "../../data/types.js";
import {
  Edge,
  GraphDescriptor,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "../../types.js";
import {
  InspectableAsset,
  InspectableAssetEdge,
  InspectableEdge,
  InspectableGraph,
  InspectableModules,
  InspectableNode,
  InspectableNodeType,
  InspectableSubgraphs,
  MutableGraph,
} from "../types.js";
import { GraphDescriberManager } from "./graph-describer-manager.js";
import { GraphQueries } from "./graph-queries.js";
import { ok } from "../../data/file-system/utils.js";

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

  async describe(
    inputs?: InputValues,
    context?: NodeDescriberContext
  ): Promise<NodeDescriberResult> {
    const manager = GraphDescriberManager.create(this.#graphId, this.#mutable);
    if (!ok(manager)) {
      throw new Error(`Inspect API Integrity Error: ${manager.$error}`);
    }
    return manager.describe(inputs, undefined, undefined, context);
  }

  graphs(): InspectableSubgraphs | undefined {
    if (this.#graphId) return;
    return this.#mutable.graphs.graphs();
  }

  graphId(): GraphIdentifier {
    return this.#graphId;
  }

  moduleExports(): Set<ModuleIdentifier> {
    return new GraphQueries(this.#mutable, this.#graphId).moduleExports();
  }

  graphExports(): Set<GraphIdentifier> {
    return new GraphQueries(this.#mutable, this.#graphId).graphExports();
  }

  imports(): Promise<Map<ImportIdentifier, Outcome<InspectableGraph>>> {
    return new GraphQueries(this.#mutable, this.#graphId).imports();
  }

  assets(): Map<AssetPath, InspectableAsset> {
    return new GraphQueries(this.#mutable, this.#graphId).assets();
  }

  assetEdges(): Outcome<InspectableAssetEdge[]> {
    return new GraphQueries(this.#mutable, this.#graphId).assetEdges();
  }
}
