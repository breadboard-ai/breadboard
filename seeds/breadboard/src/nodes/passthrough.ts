/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, OutputValues } from "../types.js";
import { SchemaBuilder } from "../schema.js";

export default {
  desribe: async (inputs?: InputValues) => {
    if (!inputs) {
      return {
        inputSchema: SchemaBuilder.empty(true),
        outputSchema: SchemaBuilder.empty(true),
      };
    }
    return {
      inputSchema: new SchemaBuilder()
        .addInputs(inputs)
        .setAdditionalProperties(true)
        .build(),
      outputSchema: new SchemaBuilder().addInputs(inputs).build(),
    };
  },
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    return inputs;
  },
};
