/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  InputValues,
  NodeDescriptor,
  OutputValues,
} from "../types.js";
import { TraversalState } from "./state.js";

export class MachineResult {
  descriptor: NodeDescriptor;
  inputs: InputValues;
  missingInputs: string[];
  opportunities: Edge[];
  newOpportunities: Edge[];
  state: TraversalState;
  outputs?: OutputValues;

  constructor(
    descriptor: NodeDescriptor,
    inputs: InputValues,
    missingInputs: string[],
    opportunities: Edge[],
    newOpportunities: Edge[],
    state: TraversalState
  ) {
    this.descriptor = descriptor;
    this.inputs = inputs;
    this.missingInputs = missingInputs;
    this.opportunities = opportunities;
    this.newOpportunities = newOpportunities;
    this.state = state;
  }

  /**
   * `true` if the machine decided that the node should be skipped, rather than
   * visited.
   */
  get skip(): boolean {
    return this.missingInputs.length > 0;
  }

  toJSON() {
    const { descriptor, inputs, missingInputs, opportunities } = this;
    return {
      descriptor,
      inputs,
      missingInputs,
      opportunities,
      state: this.state.serialize(),
    };
  }

  static fromJSON(json: string) {
    const data = JSON.parse(json);
    const { descriptor, inputs, missingInputs, opportunities, state } = data;
    return new MachineResult(
      descriptor,
      inputs,
      missingInputs,
      opportunities,
      [],
      TraversalState.deserialize(state)
    );
  }
}
