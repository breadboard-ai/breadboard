/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge as EdgeDescriptor,
  GraphDescriptor,
  GraphIdentifier,
  InspectableEdge,
  InspectableEdgeCache,
} from "@breadboard-ai/types";
import { Edge, unfixUpStarEdge } from "./edge.js";

type EdgeFactory = (
  edge: EdgeDescriptor,
  graphId: GraphIdentifier
) => InspectableEdge;

export class EdgeCache implements InspectableEdgeCache {
  #factory: EdgeFactory;
  #map: Map<GraphIdentifier, Map<EdgeDescriptor, InspectableEdge>> = new Map();

  constructor(factory: EdgeFactory) {
    this.#factory = factory;
  }

  rebuild(graph: GraphDescriptor) {
    // Initialize the edge map from the graph. This is only done once, and all
    // following updates are performed incrementally.
    const mainGraphEdges = new Map(
      graph.edges.map((edge) => [edge, this.#factory(edge, "")])
    );
    this.#map.set("", mainGraphEdges);
    Object.entries(graph.graphs || {}).forEach(([graphId, graph]) => {
      const subGraphEdges = new Map(
        graph.edges.map((edge) => [edge, this.#factory(edge, graphId)])
      );
      this.#map.set(graphId, subGraphEdges);
    });
  }

  get(
    edge: EdgeDescriptor,
    graphId: GraphIdentifier
  ): InspectableEdge | undefined {
    return this.#map.get(graphId)?.get(edge);
  }

  getOrCreate(edge: EdgeDescriptor, graphId: GraphIdentifier): InspectableEdge {
    let result = this.get(edge, graphId);
    if (result) {
      return result;
    }
    result = this.#factory(edge, graphId);
    this.add(edge, graphId);
    return result;
  }

  add(edge: EdgeDescriptor, graphId: GraphIdentifier) {
    console.assert(
      !this.#map.get(graphId)?.has(edge),
      "Edge already exists when adding."
    );
    let graphEdges = this.#map.get(graphId);
    if (!graphEdges) {
      graphEdges = new Map();
      this.#map.set(graphId, graphEdges);
    }
    graphEdges.set(edge, this.#factory(edge, graphId));
  }

  remove(edge: EdgeDescriptor, graphId: GraphIdentifier) {
    console.assert(
      this.#map.get(graphId)?.has(edge),
      "Edge not found when removing."
    );
    const inspectableEdge = this.#map.get(graphId)?.get(edge);
    this.#map.get(graphId)?.delete(edge);
    (inspectableEdge as Edge)?.setDeleted();
  }

  has(edge: EdgeDescriptor, graphId: GraphIdentifier): boolean {
    return !!this.#map.get(graphId)?.has(edge);
  }

  hasByValue(edge: EdgeDescriptor, graphId: GraphIdentifier): boolean {
    edge = unfixUpStarEdge(edge);
    const edges = this.edges(graphId);
    return !!edges.find((e) => {
      return (
        e.from.descriptor.id === edge.from &&
        e.to.descriptor.id === edge.to &&
        e.out === edge.out &&
        e.in === edge.in
      );
    });
  }

  edges(graphId: GraphIdentifier): InspectableEdge[] {
    return Array.from(this.#map.get(graphId)?.values() || []);
  }

  addSubgraphEdges(subgraph: GraphDescriptor, graphId: GraphIdentifier): void {
    subgraph.edges.map((edge) => {
      this.add(edge, graphId);
    });
  }

  removeSubgraphEdges(graphId: GraphIdentifier): void {
    this.#map.get(graphId)?.forEach((inspectableEdge) => {
      (inspectableEdge as Edge).setDeleted();
    });
    this.#map.delete(graphId);
  }
}
