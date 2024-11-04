/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  InputValues,
  NodeDescriptor,
  NodeIdentifier,
  NodeValue,
  OutputValues,
} from "./graph-descriptor.js";

/**
 * The Map of queues of all outputs that were sent to a given node,
 * and a map of these for all nodes.
 */
export type NodeValuesQueues = Map<string, NodeValue[]>;
export type NodeValuesQueuesMap = Map<NodeIdentifier, NodeValuesQueues>;

export interface QueuedNodeValuesState {
  state: NodeValuesQueuesMap;
  constants: NodeValuesQueuesMap;
  wireOutputs(opportunities: Edge[], outputs: OutputValues): void;
  getAvailableInputs(nodeId: NodeIdentifier): InputValues;
  useInputs(node: NodeIdentifier, inputs: InputValues): void;
}

export interface TraversalResult {
  descriptor: NodeDescriptor;
  inputs: InputValues;
  missingInputs: string[];
  current: Edge;
  opportunities: Edge[];
  newOpportunities: Edge[];
  state: QueuedNodeValuesState;
  outputs?: OutputValues;
  partialOutputs?: OutputValues;
  skip: boolean;
}
