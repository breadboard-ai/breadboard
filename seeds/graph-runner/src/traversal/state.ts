/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  EdgeMap,
  EdgeState,
  EdgeStateMap,
  NodeIdentifier,
  OutputValues,
} from "../types.js";

export class MachineEdgeState implements EdgeState {
  state: EdgeStateMap = new Map();
  constants: EdgeStateMap = new Map();

  #splitOutConstants(edges: Edge[]): [Edge[], Edge[]] {
    const constants: Edge[] = [];
    const rest: Edge[] = [];
    edges.forEach((edge) => {
      if (edge.constant) constants.push(edge);
      else rest.push(edge);
    });
    return [constants, rest];
  }

  #addToState(
    state: EdgeStateMap,
    opportunities: Edge[],
    outputs: OutputValues
  ) {
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

  getAvailableOutputs(node: NodeIdentifier): EdgeMap {
    const constantEdges: EdgeMap = this.constants.get(node) || new Map();
    const stateEdges: EdgeMap = this.state.get(node) || new Map();
    const result: EdgeMap = new Map([...constantEdges, ...stateEdges]);
    return result;
  }
}
