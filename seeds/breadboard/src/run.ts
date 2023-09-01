/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriptor,
  OutputValues,
  TraversalResult,
} from "@google-labs/graph-runner";
import type { BreadbordRunResult } from "./types.js";

export class InputStageResult implements BreadbordRunResult {
  seeksInputs = true;
  #inputs: InputValues = {};
  #state: TraversalResult;

  constructor(state: TraversalResult) {
    this.#state = state;
  }

  get node(): NodeDescriptor {
    return this.#state.descriptor;
  }

  get inputArguments(): InputValues {
    return this.#state.inputs;
  }

  set inputs(inputs: InputValues) {
    this.#inputs = inputs;
  }

  get inputs(): InputValues {
    return this.#inputs;
  }

  get outputs(): OutputValues {
    throw new Error("Outputs are not available in the input stage");
  }

  get state(): TraversalResult {
    return this.#state;
  }
}

export class OutputStageResult implements BreadbordRunResult {
  seeksInputs = false;
  #state: TraversalResult;

  constructor(state: TraversalResult) {
    this.#state = state;
  }

  get node(): NodeDescriptor {
    return this.#state.descriptor;
  }

  get inputArguments(): InputValues {
    throw new Error("Input arguments are not available in the output stage");
  }

  set inputs(inputs: InputValues) {
    throw new Error("Setting inputs is not available in the output stage");
  }

  get outputs(): OutputValues {
    return this.#state.inputs;
  }

  get state(): TraversalResult {
    return this.#state;
  }
}
