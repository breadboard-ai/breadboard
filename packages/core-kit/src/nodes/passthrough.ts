/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeHandlerObject,
  OutputValues,
} from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";

export default {
  metadata: {
    title: "Passthrough",
    description:
      "Takes all inputs and passes them through as outputs. Effectively, a no-op node in Breadboard.",
  },
  describe: async (inputs?: InputValues) => {
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
} satisfies NodeHandlerObject;
