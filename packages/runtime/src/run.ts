/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardRunResult,
  InputValues,
  NodeDescriptor,
  OutputValues,
  RunResultType,
  RunState,
  TraversalResult,
} from "@breadboard-ai/types";
import { timestamp } from "@breadboard-ai/utils";
import { loadRunnerState, saveRunnerState } from "./serialization.js";

export class RunResult implements BreadboardRunResult {
  #type: RunResultType;
  #state: TraversalResult;
  // TODO: Remove #state and rename this to #state
  #runState: RunState | undefined;
  // TODO: Remove this once RunState machinery works
  #invocationId;
  #path: number[];

  constructor(
    state: TraversalResult,
    type: RunResultType,
    runState: RunState | undefined,
    invocationId: number,
    path: number[]
  ) {
    this.#state = state;
    this.#type = type;
    this.#runState = runState;
    this.#invocationId = invocationId;
    this.#path = path;
  }

  get invocationId(): number {
    return this.#invocationId;
  }

  get path(): number[] {
    return this.#path;
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
    this.#state.outputs = {
      ...inputs,
      ...this.#state.partialOutputs,
    };
  }

  get outputs(): OutputValues {
    // Remove "schema" input for the "output" node, because it always be
    // the schema for the output, rather than an actual value passed over the
    // wire.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { schema, ...outputs } = this.#state.inputs;
    return outputs;
  }

  get state(): TraversalResult {
    return this.#state;
  }

  save() {
    return saveRunnerState(this.#type, this.#state);
  }

  get runState(): RunState | undefined {
    return this.#runState;
  }

  get timestamp(): number {
    return timestamp();
  }

  isAtExitNode(): boolean {
    return (
      this.#state.newOpportunities.length === 0 &&
      this.#state.opportunities.length === 0
    );
  }

  static load(stringifiedResult: string): RunResult {
    const { state, type } = loadRunnerState(stringifiedResult);
    return new RunResult(state, type, undefined, 0, []);
  }
}

export class InputStageResult extends RunResult {
  constructor(
    state: TraversalResult,
    runState: RunState | undefined,
    invocationId: number,
    path: number[]
  ) {
    super(state, "input", runState, invocationId, path);
  }

  get outputs(): OutputValues {
    throw new Error('Outputs are not available in the "input" stage');
  }
}

export class OutputStageResult extends RunResult {
  constructor(state: TraversalResult, invocationId: number, path: number[]) {
    super(state, "output", undefined, invocationId, path);
  }

  get inputArguments(): InputValues {
    throw new Error('Input arguments are not available in the "output" stage');
  }

  set inputs(inputs: InputValues) {
    throw new Error('Setting inputs is not available in the "output" stage');
  }
}
