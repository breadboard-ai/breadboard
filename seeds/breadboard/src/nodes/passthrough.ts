/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, OutputValues } from "../types.js";
import { empty, fromInputs } from "../schema.js";

export default {
  desribe: async (inputs?: InputValues) => {
    if (!inputs) {
      return {
        inputSchema: empty(true),
        outputSchema: empty(true),
      };
    }
    return {
      inputSchema: fromInputs(inputs, true),
      outputSchema: fromInputs(inputs),
    };
  },
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    return inputs;
  },
};
