/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState, saveRunnerState } from "./serialization.js";
import type {
  InputValues,
  NodeDescriptor,
  OutputValues,
  TraversalResult,
  BreadboardRunResult,
  RunResultType,
} from "./types.js";

export class RunResult implements BreadboardRunResult {
  #type: RunResultType;
  #state: TraversalResult;
  #invocationId;

  constructor(
    state: TraversalResult,
    type: RunResultType,
    invocationId: number
  ) {
    this.#state = state;
    this.#type = type;
    this.#invocationId = invocationId;
  }

  get invocationId(): number {
    return this.#invocationId;
  }

  get type(): RunResultType {
    return this.#type;
  }

  get node(): NodeDescriptor {
    return this.#state.descriptor;
  }

  get inputArguments(): InputValues {
    return this.#state.inputs;
  }

  set inputs(inputs: InputValues) {
    this.#state.outputsPromise = Promise.resolve(inputs);
  }

  get outputs(): OutputValues {
    return this.#state.inputs;
  }

  get state(): TraversalResult {
    return this.#state;
  }

  async save() {
    return saveRunnerState(this.#type, this.#state);
  }

  isAtExitNode(): boolean {
    return (
      this.#state.newOpportunities.length === 0 &&
      this.#state.opportunities.length === 0 &&
      this.#state.pendingOutputs.size === 0
    );
  }

  static load(stringifiedResult: string): RunResult {
    const { state, type } = loadRunnerState(stringifiedResult);
    return new RunResult(state, type, 0);
  }
}

export class InputStageResult extends RunResult {
  constructor(state: TraversalResult, invocationId: number) {
    super(state, "input", invocationId);
  }

  get outputs(): OutputValues {
    throw new Error('Outputs are not available in the "input" stage');
  }
}

export class OutputStageResult extends RunResult {
  constructor(state: TraversalResult, invocationId: number) {
    super(state, "output", invocationId);
  }

  get inputArguments(): InputValues {
    throw new Error('Input arguments are not available in the "output" stage');
  }

  set inputs(inputs: InputValues) {
    throw new Error('Setting inputs is not available in the "output" stage');
  }
}
