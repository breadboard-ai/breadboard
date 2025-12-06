/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  QueuedNodeValuesState,
  InputValues,
  NodeDescriptor,
  OutputValues,
  TraversalResult,
} from "@breadboard-ai/types";
import { MachineEdgeState } from "./state.js";

export class MachineResult implements TraversalResult {
  descriptor: NodeDescriptor;
  inputs: InputValues;
  missingInputs: string[];
  current: Edge;
  opportunities: Edge[];
  newOpportunities: Edge[];
  state: QueuedNodeValuesState;
  outputs?: OutputValues;
  partialOutputs?: OutputValues;

  constructor(
    descriptor: NodeDescriptor,
    inputs: InputValues,
    missingInputs: string[],
    currentOpportunity: Edge,
    opportunities: Edge[],
    newOpportunities: Edge[],
    state: QueuedNodeValuesState,
    partialOutputs?: OutputValues
  ) {
    this.descriptor = descriptor;
    this.inputs = inputs;
    this.missingInputs = missingInputs;
    this.current = currentOpportunity;
    this.opportunities = opportunities;
    this.newOpportunities = newOpportunities;
    this.state = state;
    this.partialOutputs = partialOutputs;
  }

  /**
   * `true` if the machine decided that the node should be skipped, rather than
   * visited.
   */
  get skip(): boolean {
    return this.missingInputs.length > 0;
  }

  static fromObject(o: TraversalResult): MachineResult {
    const edgeState = new MachineEdgeState();
    edgeState.constants = o.state.constants;
    edgeState.state = o.state.state;
    return new MachineResult(
      o.descriptor,
      o.inputs,
      o.missingInputs,
      o.current,
      o.opportunities,
      o.newOpportunities,
      edgeState,
      o.partialOutputs
    );
  }
}
