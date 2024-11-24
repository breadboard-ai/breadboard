/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge as EdgeDescriptor,
  GraphDescriptor,
  GraphIdentifier,
} from "../types.js";
import {
  InspectableEdge,
  InspectableEdgeCache,
  InspectableEdgeType,
  InspectableNodeCache,
  InspectablePort,
  ValidateResult,
} from "./types.js";

export { Edge };

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
  #nodes: InspectableNodeCache | null;
  #edge: EdgeDescriptor;
  #graphId: GraphIdentifier;

  constructor(
    nodes: InspectableNodeCache,
    edge: EdgeDescriptor,
    graphId: GraphIdentifier
  ) {
    this.#nodes = nodes;
    this.#edge = edge;
    this.#graphId = graphId;
  }

  raw(): EdgeDescriptor {
    return this.#edge;
  }

  get from() {
    if (!this.#nodes) {
      throw new Error(
        `Unable to access "from": this edge was deleted and is no longer part of the graph`
      );
    }
    const from = this.#nodes.get(this.#edge.from, this.#graphId);
    console.assert(from, "From node not found when getting from.");
    return from!;
  }

  get out() {
    return this.#edge.out as string;
  }

  get to() {
    if (!this.#nodes) {
      throw new Error(
        `Unable to access "to": this edge was deleted and is no longer part of the graph`
      );
    }
    const to = this.#nodes.get(this.#edge.to, this.#graphId);
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

  setDeleted() {
    this.#nodes = null;
  }

  deleted(): boolean {
    return !this.#nodes;
  }
}

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
