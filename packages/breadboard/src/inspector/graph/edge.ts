/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EdgeMetadata } from "@breadboard-ai/types";
import { Edge as EdgeDescriptor, GraphIdentifier } from "../../types.js";
import {
  InspectableEdge,
  InspectableEdgeType,
  InspectablePort,
  MutableGraph,
  ValidateResult,
} from "../types.js";

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
  #mutable: MutableGraph | null;
  #edge: EdgeDescriptor;
  #graphId: GraphIdentifier;

  constructor(
    mutable: MutableGraph,
    edge: EdgeDescriptor,
    graphId: GraphIdentifier
  ) {
    this.#mutable = mutable;
    this.#edge = edge;
    this.#graphId = graphId;
  }

  raw(): EdgeDescriptor {
    return this.#edge;
  }

  get from() {
    if (!this.#mutable) {
      throw new Error(
        `Unable to access "from": this edge was deleted and is no longer part of the graph`
      );
    }
    const from = this.#mutable.nodes.get(this.#edge.from, this.#graphId);
    console.assert(from, "From node not found when getting from.");
    return from!;
  }

  get out() {
    return this.#edge.out as string;
  }

  get to() {
    if (!this.#mutable) {
      throw new Error(
        `Unable to access "to": this edge was deleted and is no longer part of the graph`
      );
    }
    const to = this.#mutable.nodes.get(this.#edge.to, this.#graphId);
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

  metadata(): EdgeMetadata | undefined {
    return this.#edge.metadata;
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
    this.#mutable = null;
  }

  deleted(): boolean {
    return !this.#mutable;
  }
}
