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
    state?: TraversalState
  ) {
    this.descriptor = descriptor;
    this.inputs = inputs;
    this.missingInputs = missingInputs;
    this.opportunities = opportunities;
    this.newOpportunities = newOpportunities;
    this.state = state ?? new TraversalState();
  }

  /**
   * `true` if the machine decided that the node should be skipped, rather than
   * run.
   */
  get skip(): boolean {
    return this.missingInputs.length > 0;
  }

  /**
   * Sentinel value for when the machine is done.
   */
  static empty = new MachineResult(
    { id: "$empty", type: "$empty" },
    {},
    [],
    [],
    []
  );
}
