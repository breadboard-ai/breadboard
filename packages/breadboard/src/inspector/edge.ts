/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge as EdgeDescriptor, GraphDescriptor } from "../types.js";
import {
  EdgeStoreMutator,
  InspectableEdge,
  InspectableEdgeType,
  InspectableNodeCache,
  InspectablePort,
  ValidateResult,
} from "./types.js";

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

/**
 * This is inverse of the helper above, necessary when working with
 * instances of `InspectableEdge` directly, since they will show "*" on both
 * sides of the edge.
 * @param edge -- the edge to un-fix up
 * @returns
 */
export const unfixUpStarEdge = (edge: EdgeDescriptor): EdgeDescriptor => {
  if (edge.out === "*") {
    return { ...edge, in: "*" };
  }
  return edge;
};

export const fixupConstantEdge = (edge: EdgeDescriptor): EdgeDescriptor => {
  const { constant, ...rest } = edge;
  if (constant === false) {
    return rest;
  }
  return edge;
};

class Edge implements InspectableEdge {
  #nodes: InspectableNodeCache;
  #edge: EdgeDescriptor;

  constructor(nodes: InspectableNodeCache, edge: EdgeDescriptor) {
    this.#nodes = nodes;
    this.#edge = edge;
  }

  get from() {
    const from = this.#nodes.get(this.#edge.from);
    console.assert(from, "From node not found when getting from.");
    return from!;
  }

  get out() {
    return this.#edge.out as string;
  }

  get to() {
    const to = this.#nodes.get(this.#edge.to);
    console.assert(to, "To node not found when getting to.");
    return to!;
  }

  get in() {
    const edgein = this.#edge.out === "*" ? "*" : this.#edge.in;
    return edgein as string;
  }

  get type() {
    if (this.#edge.out === "*") return InspectableEdgeType.Star;
    if (this.#edge.out === "") return InspectableEdgeType.Control;
    if (this.#edge.constant) return InspectableEdgeType.Constant;
    return InspectableEdgeType.Ordinary;
  }

  async outPort(): Promise<InspectablePort> {
    const ports = await this.from.ports();
    return ports.outputs.ports.find((port) => port.name === this.out)!;
  }

  async inPort(): Promise<InspectablePort> {
    const ports = await this.to.ports();
    return ports.inputs.ports.find((port) => port.name === this.in)!;
  }

  async validate(): Promise<ValidateResult> {
    const [outPort, inPort] = await Promise.all([
      this.outPort(),
      this.inPort(),
    ]);
    if (outPort === undefined || inPort === undefined) {
      return { status: "unknown" };
    }
    const canConnectAnalysis = outPort.type.analyzeCanConnect(inPort.type);
    if (!canConnectAnalysis.canConnect) {
      return {
        status: "invalid",
        errors: canConnectAnalysis.details,
      };
    }
    return { status: "valid" };
  }
}

export class EdgeCache implements EdgeStoreMutator {
  #nodes: InspectableNodeCache;
  #map: Map<EdgeDescriptor, InspectableEdge> = new Map();

  constructor(nodes: InspectableNodeCache) {
    this.#nodes = nodes;
  }

  populate(graph: GraphDescriptor) {
    // Initialize the edge map from the graph. This is only done once, and all
    // following updates are performed incrementally.
    return (this.#map = new Map(
      graph.edges.map((edge) => [edge, new Edge(this.#nodes, edge)])
    ));
  }

  get(edge: EdgeDescriptor): InspectableEdge | undefined {
    return this.#map.get(edge);
  }

  getOrCreate(edge: EdgeDescriptor): InspectableEdge {
    let result = this.get(edge);
    if (result) {
      return result;
    }
    result = new Edge(this.#nodes, edge);
    this.add(edge);
    return result;
  }

  add(edge: EdgeDescriptor) {
    console.assert(!this.#map.has(edge), "Edge already exists when adding.");
    this.#map.set(edge, new Edge(this.#nodes, edge));
  }

  remove(edge: EdgeDescriptor) {
    console.assert(this.#map.has(edge), "Edge not found when removing.");
    this.#map.delete(edge);
  }

  has(edge: EdgeDescriptor): boolean {
    return this.#map.has(edge);
  }

  hasByValue(edge: EdgeDescriptor): boolean {
    edge = unfixUpStarEdge(edge);
    const edges = this.edges();
    return !!edges.find((e) => {
      return (
        e.from.descriptor.id === edge.from &&
        e.to.descriptor.id === edge.to &&
        e.out === edge.out &&
        e.in === edge.in
      );
    });
  }

  edges(): InspectableEdge[] {
    return Array.from(this.#map.values());
  }
}
