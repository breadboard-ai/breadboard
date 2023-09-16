/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  EdgeMap,
  InputValues,
  NodeDescriptor,
  OutputValues,
} from "../types.js";

/**
 * This class holds important parts of the graph traversal algorithm.
 */
export class Traversal {
  static wireEdge(edge: Edge, outputs: OutputValues): InputValues {
    const out = edge.out;
    if (!out) return {};
    if (out === "*") {
      return Object.assign({}, outputs);
    }
    const output = outputs[out];
    const input = edge.in;
    if (!input || output === null || output === undefined) return {};
    return { [input]: output };
  }

  /**
   * Wires the outputs of of a set of edges to the inputs of a node.
   * @param heads All the edges that point to the node.
   * @param outputEdges Outputs that are available from the node.
   * @returns The input values that will be passed to the node.
   */
  static wire(heads: Edge[], outputEdges: EdgeMap): InputValues {
    const result: InputValues = {};
    heads.forEach((head) => {
      const from = head.from;
      const inputs = this.wireEdge(head, outputEdges.get(from) || {});
      Object.assign(result, inputs);
    });
    return result;
  }

  /**
   * Computes the missing inputs for a node. A missing input is an input that is
   * required by the node, but is not (yet) available in the current state.
   * @param heads All the edges that point to the node.
   * @param inputs The input values that will be passed to the node
   * @param current The node that is being visited.
   * @returns Array of missing input names.
   */
  static computeMissingInputs(
    heads: Edge[],
    inputs: InputValues,
    current: NodeDescriptor
  ): string[] {
    const requiredInputs: string[] = [
      ...new Set(
        heads
          .filter((edge: Edge) => !!edge.in && !edge.optional)
          .map((edge: Edge) => edge.in || "")
      ),
    ];
    const inputsWithConfiguration = new Set();
    Object.keys(inputs).forEach((key) => inputsWithConfiguration.add(key));
    if (current.configuration) {
      Object.keys(current.configuration).forEach((key) =>
        inputsWithConfiguration.add(key)
      );
    }
    return requiredInputs.filter(
      (input) => !inputsWithConfiguration.has(input)
    );
  }
}
