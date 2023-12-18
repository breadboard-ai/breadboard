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
  CompletedNodeOutput,
  TraversalResult,
} from "../types.js";
import { MachineEdgeState } from "./state.js";

export class MachineResult implements TraversalResult {
  descriptor: NodeDescriptor;
  inputs: InputValues;
  missingInputs: string[];
  opportunities: Edge[];
  newOpportunities: Edge[];
  state: QueuedNodeValuesState;
  outputsPromise?: Promise<OutputValues>;
  pendingOutputs: Map<symbol, Promise<CompletedNodeOutput>>;

  constructor(
    descriptor: NodeDescriptor,
    inputs: InputValues,
    missingInputs: string[],
    opportunities: Edge[],
    newOpportunities: Edge[],
    state: QueuedNodeValuesState,
    pendingOutputs: Map<symbol, Promise<CompletedNodeOutput>>
  ) {
    this.descriptor = descriptor;
    this.inputs = inputs;
    this.missingInputs = missingInputs;
    this.opportunities = opportunities;
    this.newOpportunities = newOpportunities;
    this.state = state;
    this.pendingOutputs = pendingOutputs;
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
      o.opportunities,
      o.newOpportunities,
      edgeState,
      o.pendingOutputs
    );
  }
}
