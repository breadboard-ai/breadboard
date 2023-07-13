/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, OutputValues } from "@google-labs/graph-runner";
import type { BreadbordRunResult } from "./types.js";

export class InputStageResult implements BreadbordRunResult {
  seeksInputs = true;
  #args: InputValues = {};
  #inputs: InputValues = {};

  constructor(args: InputValues) {
    this.#args = args;
  }

  get inputArguments(): InputValues {
    return this.#args;
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
}

export class OutputStageResult implements BreadbordRunResult {
  seeksInputs = false;
  #outputs: OutputValues = {};

  constructor(outputs: OutputValues) {
    this.#outputs = outputs;
  }

  get inputArguments(): InputValues {
    throw new Error("Input arguments are not available in the output stage");
  }

  set inputs(inputs: InputValues) {
    throw new Error("Setting inputs is not available in the output stage");
  }

  get outputs(): OutputValues {
    return this.#outputs;
  }
}
