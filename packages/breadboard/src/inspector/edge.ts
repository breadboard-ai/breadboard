/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge as EdgeDescriptor } from "../types.js";
import { InspectableEdge, InspectableGraph, InspectableNode } from "./types.js";

/**
 * This helper is necessary because both "*" and "" are valid representations
 * of a wildcard edge tail. This function ensures that the edge is always
 * consistent.
 * @param edge -- the edge to fix up
 * @returns
 */
export const fixUpStarEdge = (edge: EdgeDescriptor): EdgeDescriptor => {
  if (edge.out === "*") {
    return { ...edge, in: "" };
  }
  return edge;
};

class Edge implements InspectableEdge {
  #graph: InspectableGraph;
  #edge: EdgeDescriptor;

  constructor(graph: InspectableGraph, edge: EdgeDescriptor) {
    this.#graph = graph;
    this.#edge = edge;
  }

  get from() {
    const from = this.#graph.nodeById(this.#edge.from);
    console.assert(from, "From node not found when getting from.");
    return from as InspectableNode;
  }

  get out() {
    return this.#edge.out as string;
  }

  get to() {
    const to = this.#graph.nodeById(this.#edge.to);
    console.assert(to, "To node not found when getting to.");
    return to as InspectableNode;
  }

  get in() {
    const edgein = this.#edge.out === "*" ? "*" : this.#edge.in;
    return edgein as string;
  }
}

export class InspectableEdgeCache {
  #graph: InspectableGraph;
  #map?: Map<EdgeDescriptor, InspectableEdge>;

  constructor(graph: InspectableGraph) {
    this.#graph = graph;
  }

  #ensureEdgeMap() {
    // Initialize the edge map from the graph. This is only done once, and all
    // following updates are performed incrementally.
    const graph = this.#graph;
    return (this.#map ??= new Map(
      graph.raw().edges.map((edge) => [edge, new Edge(graph, edge)])
    ));
  }

  get(edge: EdgeDescriptor): InspectableEdge | undefined {
    return this.#ensureEdgeMap().get(edge);
  }

  add(edge: EdgeDescriptor) {
    if (!this.#map) {
      // If the map is not yet initialized, we can exit early. since we presume
      // that this.#graph is the source of truth and next time this.#map is
      // accessed, it will be initialized.
      return;
    }
    console.assert(!this.#map.has(edge), "Edge already exists when adding.");
    this.#map.set(edge, new Edge(this.#graph, edge));
  }

  remove(edge: EdgeDescriptor) {
    if (!this.#map) {
      // Same as above ...
      return;
    }
    console.assert(this.#map.has(edge), "Edge not found when removing.");
    this.#map.delete(edge);
  }

  has(edge: EdgeDescriptor): boolean {
    return this.#ensureEdgeMap().has(edge);
  }

  hasByValue(edge: EdgeDescriptor): boolean {
    edge = fixUpStarEdge(edge);
    return !!this.#graph.raw().edges.find((e) => {
      return (
        e.from === edge.from &&
        e.to === edge.to &&
        e.out === edge.out &&
        e.in === edge.in
      );
    });
  }

  edges(): InspectableEdge[] {
    return Array.from(this.#ensureEdgeMap().values());
  }
}
