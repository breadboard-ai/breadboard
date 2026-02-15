/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AssetPath,
  Edge as EdgeDescriptor,
  GraphDescriptor,
  GraphIdentifier,
  GraphMetadata,
  InspectableAsset,
  InspectableAssetEdge,
  InspectableEdge,
  InspectableGraph,
  InspectableNode,
  InspectableNodeType,
  InspectableSubgraphs,
  MutableGraph,
  NodeIdentifier,
  NodeTypeIdentifier,
  Outcome,
} from "@breadboard-ai/types";
import { GraphQueries } from "./graph-queries.js";
import { Edge } from "./edge.js";
import { unfixUpStarEdge } from "./edge.js";

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

  edges(): InspectableEdge[] {
    return this.#descriptor().edges.map(
      (edge) => new Edge(this.#mutable, edge, this.#graphId)
    );
  }

  hasEdge(edge: EdgeDescriptor): boolean {
    const fixed = unfixUpStarEdge(edge);
    return !!this.#descriptor().edges.find(
      (e) =>
        e.from === fixed.from &&
        e.to === fixed.to &&
        e.out === fixed.out &&
        e.in === fixed.in
    );
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

  graphs(): InspectableSubgraphs | undefined {
    if (this.#graphId) return;
    return this.#mutable.graphs.graphs();
  }

  graphId(): GraphIdentifier {
    return this.#graphId;
  }

  graphExports(): Set<GraphIdentifier> {
    return new GraphQueries(this.#mutable, this.#graphId).graphExports();
  }

  assets(): Map<AssetPath, InspectableAsset> {
    return new GraphQueries(this.#mutable, this.#graphId).assets();
  }

  assetEdges(): Outcome<InspectableAssetEdge[]> {
    return new GraphQueries(this.#mutable, this.#graphId).assetEdges();
  }

  usesTool(path: string): boolean {
    return new GraphQueries(this.#mutable, this.#graphId).usesTool(path);
  }
}
