/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MachineResult } from "./traversal/result.js";
import { TraversalMachine } from "./traversal/machine.js";
import type {
  InputValues,
  NodeDescriptor,
  OutputValues,
  TraversalResult,
  BreadboardRunResult,
  RunResultType,
} from "./types.js";

export const replacer = (key: string, value: unknown) => {
  if (!(value instanceof Map)) return value;

  return {
    $type: "Map",
    value: Array.from(value.entries()),
  };
};

export const reviver = (
  key: string,
  value: unknown & {
    $type?: string;
    value: Iterable<readonly [string, unknown]>;
  }
) => {
  const { $type } = (value || {}) as { $type?: string };
  return $type == "Map" && value.value
    ? new Map<string, unknown>(value.value)
    : value;
};

export class RunResult implements BreadboardRunResult {
  #type: RunResultType;
  #state: TraversalResult;
  #invocationId;
  #secret;

  constructor(
    state: TraversalResult,
    type: RunResultType,
    invocationId: number,
    secret = false
  ) {
    this.#state = state;
    this.#type = type;
    this.#invocationId = invocationId;
    this.#secret = secret;
  }

  get invocationId(): number {
    return this.#invocationId;
  }

  get secret(): boolean {
    return this.#secret;
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
    return JSON.stringify(
      {
        state: await TraversalMachine.prepareToSafe(this.#state),
        type: this.#type,
      },
      replacer
    );
  }

  isAtExitNode(): boolean {
    return (
      this.#state.newOpportunities.length === 0 &&
      this.#state.opportunities.length === 0 &&
      this.#state.pendingOutputs.size === 0
    );
  }

  static load(stringifiedResult: string): RunResult {
    const { state, type } = JSON.parse(stringifiedResult, reviver);
    const machineResult = MachineResult.fromObject(state);
    return new RunResult(machineResult, type, 0);
  }
}

export class InputStageResult extends RunResult {
  constructor(state: TraversalResult, invocationId: number, secret = false) {
    super(state, "input", invocationId, secret);
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
