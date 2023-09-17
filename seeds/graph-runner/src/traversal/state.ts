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
  SendingNodeMap,
} from "../types.js";

export const peek = (map?: SendingNodeMap): EdgeMap => {
  map = map || new Map();
  const result: EdgeMap = new Map();
  for (const [from, queue] of map.entries()) {
    const outputs = queue[0];
    if (outputs) result.set(from, outputs);
  }
  return result;
};

export class EdgeQueuer {
  map: EdgeStateMap;

  constructor(map: EdgeStateMap) {
    this.map = map;
  }

  push(edge: Edge, values?: OutputValues): void {
    if (!values) return;
    const toNode = edge.to;
    let fromNodeMap = this.map.get(toNode);
    if (!fromNodeMap) {
      fromNodeMap = new Map() as SendingNodeMap;
      this.map.set(toNode, fromNodeMap);
    }
    let queue = fromNodeMap.get(edge.from);
    if (!queue) {
      queue = [];
      fromNodeMap.set(edge.from, queue);
    }
    queue.push(values);
  }

  shift(node: NodeIdentifier) {
    const fromNodeMap = this.map.get(node);
    if (!fromNodeMap) return;
    for (const queue of fromNodeMap.values()) {
      queue.shift();
    }
  }
}

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
      // TODO: Clean this up and make coherent with Traversal.wireEdge.
      let values: OutputValues | undefined = undefined;
      if (opportunity.out) {
        if (opportunity.out === "*") {
          values = Object.assign({}, outputs);
        } else {
          const output = outputs[opportunity.out];
          if (output != null && output != undefined) {
            values = { [opportunity.out]: output };
          }
        }
      } else {
        values = {};
      }
      new EdgeQueuer(state).push(opportunity, values);
    });
  }

  update(node: NodeIdentifier, opportunities: Edge[], outputs?: OutputValues) {
    // 1. Clear entries for the current node.
    // Notice, we're not clearing the "constants" entries. Those are basically
    // there forever -- or until the edge is traversed again.
    new EdgeQueuer(this.state).shift(node);
    if (!outputs) outputs = {};
    const [constants, state] = this.#splitOutConstants(opportunities);
    // 2. Add entries for each opportunity.
    this.#addToState(this.state, state, outputs);
    this.#addToState(this.constants, constants, outputs);
  }

  getAvailableOutputs(node: NodeIdentifier): EdgeMap {
    const constantEdges = peek(this.constants.get(node));
    const stateEdges = peek(this.state.get(node));
    const result: EdgeMap = new Map([...constantEdges, ...stateEdges]);
    return result;
  }
}
