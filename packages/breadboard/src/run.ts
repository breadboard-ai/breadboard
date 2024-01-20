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
  RunState,
} from "./types.js";

export class RunResult implements BreadboardRunResult {
  #type: RunResultType;
  #state: TraversalResult;
  // TODO: Remove #state and rename this to #state
  #runState: RunState | undefined;
  // TODO: Remove this once RunState machinery works
  #invocationId;

  constructor(
    state: TraversalResult,
    type: RunResultType,
    runState: RunState | undefined,
    invocationId: number
  ) {
    this.#state = state;
    this.#type = type;
    this.#runState = runState;
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

  get runState(): RunState | undefined {
    return this.#runState;
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
    return new RunResult(state, type, undefined, 0);
  }
}

export class InputStageResult extends RunResult {
  constructor(
    state: TraversalResult,
    runState: RunState | undefined,
    invocationId: number
  ) {
    super(state, "input", runState, invocationId);
  }

  get outputs(): OutputValues {
    throw new Error('Outputs are not available in the "input" stage');
  }
}

export class OutputStageResult extends RunResult {
  constructor(state: TraversalResult, invocationId: number) {
    super(state, "output", undefined, invocationId);
  }

  get inputArguments(): InputValues {
    throw new Error('Input arguments are not available in the "output" stage');
  }

  set inputs(inputs: InputValues) {
    throw new Error('Setting inputs is not available in the "output" stage');
  }
}
