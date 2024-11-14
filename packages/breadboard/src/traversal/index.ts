/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier } from "@breadboard-ai/types";
import { Edge, InputValues, NodeDescriptor } from "../types.js";

const requiredInputsFromEdges = (edges: Edge[]): string[] => {
  return [
    ...new Set(
      edges
        .filter((edge: Edge) => !!edge.in && !edge.optional)
        .map((edge: Edge) => edge.in || "")
    ),
  ];
};

/**
 * This class holds important parts of the graph traversal algorithm.
 */
export class Traversal {
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
    current: NodeDescriptor,
    start?: NodeIdentifier
  ): string[] {
    const isStartNode = current.id === start;
    const requiredInputs: string[] = isStartNode
      ? []
      : requiredInputsFromEdges(heads);
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
