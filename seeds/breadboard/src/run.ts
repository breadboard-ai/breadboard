/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MachineResult,
  type InputValues,
  type NodeDescriptor,
  type OutputValues,
  type TraversalResult,
} from "@google-labs/graph-runner";
import type { BreadboardRunResult, RunResultType } from "./types.js";

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

  constructor(state: TraversalResult, type: RunResultType) {
    this.#state = state;
    this.#type = type;
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
    this.#state.outputs = inputs;
  }

  get inputs(): InputValues {
    return this.#state.outputs || {};
  }

  get outputs(): OutputValues {
    return this.#state.inputs;
  }

  get state(): TraversalResult {
    return this.#state;
  }

  save() {
    return JSON.stringify({ state: this.#state, type: this.#type }, replacer);
  }

  isAtExitNode(): boolean {
    return (
      this.#state.newOpportunities.length === 0 &&
      this.#state.opportunities.length === 0
    );
  }

  static load(stringifiedResult: string): RunResult {
    const { state, type } = JSON.parse(stringifiedResult, reviver);
    const machineResult = MachineResult.fromObject(state);
    return new RunResult(machineResult, type);
  }
}

export class InputStageResult extends RunResult {
  constructor(state: TraversalResult) {
    super(state, "input");
  }

  get outputs(): OutputValues {
    throw new Error('Outputs are not available in the "input" stage');
  }
}

export class OutputStageResult extends RunResult {
  constructor(state: TraversalResult) {
    super(state, "output");
  }

  get inputArguments(): InputValues {
    throw new Error('Input arguments are not available in the "output" stage');
  }

  set inputs(inputs: InputValues) {
    throw new Error('Setting inputs is not available in the "output" stage');
  }
}

export class BeforeHandlerStageResult extends RunResult {
  constructor(state: TraversalResult) {
    super(state, "beforehandler");
  }

  get inputArguments(): InputValues {
    throw new Error(
      'Input arguments are not available in the "befoerhandler" stage'
    );
  }

  set inputs(inputs: InputValues) {
    throw new Error("Setting inputs is not available in the output stage");
  }
}
