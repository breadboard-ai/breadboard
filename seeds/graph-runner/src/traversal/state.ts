/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge, EdgeMap, NodeIdentifier, OutputValues } from "../types.js";

/**
 * Additional concept: whether or not an output was consumed by the intended
 * input.
 * State stores all outputs that have not yet been consumed, organized as
 * a map of maps
 */
type StateMap = Map<string, Map<string, OutputValues>>;

export class TraversalState {
  state: StateMap = new Map();
  constants: StateMap = new Map();

  #splitOutConstants(edges: Edge[]): [Edge[], Edge[]] {
    const constants: Edge[] = [];
    const rest: Edge[] = [];
    edges.forEach((edge) => {
      if (edge.constant) constants.push(edge);
      else rest.push(edge);
    });
    return [constants, rest];
  }

  #addToState(state: StateMap, opportunities: Edge[], outputs: OutputValues) {
    opportunities.forEach((opportunity) => {
      const toNode = opportunity.to;
      let fromNodeMap = state.get(toNode);
      if (!fromNodeMap) {
        fromNodeMap = new Map();
        state.set(toNode, fromNodeMap);
      }
      fromNodeMap.set(opportunity.from, outputs);
    });
  }

  update(node: NodeIdentifier, opportunities: Edge[], outputs?: OutputValues) {
    // 1. Clear entries for the current node.
    // Notice, we're not clearing the "constants" entries. Those are basically
    // there forever -- or until the edge is traversed again.
    this.state.delete(node);
    if (!outputs) outputs = {};
    const [constants, state] = this.#splitOutConstants(opportunities);
    // 2. Add entries for each opportunity.
    this.#addToState(this.state, state, outputs);
    this.#addToState(this.constants, constants, outputs);
  }

  getAvailableOutputs(node: NodeIdentifier) {
    const constantEdges: EdgeMap = this.constants.get(node) || new Map();
    const stateEdges: EdgeMap = this.state.get(node) || new Map();
    const result: EdgeMap = new Map([...constantEdges, ...stateEdges]);
    return result;
  }

  static replacer(key: string, value: unknown) {
    if (!(value instanceof Map)) return value;

    return {
      $type: "Map",
      value: Array.from(value.entries()),
    };
  }

  static reviver(
    key: string,
    value: unknown & {
      $type?: string;
      value: Iterable<readonly [string, unknown]>;
    }
  ) {
    const { $type } = (value || {}) as { $type?: string };
    return $type == "Map" && value.value
      ? new Map<string, unknown>(value.value)
      : value;
  }

  serialize(): string {
    return JSON.stringify(this, TraversalState.replacer);
  }

  static deserialize(json: string): TraversalState {
    const data = JSON.parse(json, TraversalState.reviver);
    return Object.assign(new TraversalState(), data);
  }
}
