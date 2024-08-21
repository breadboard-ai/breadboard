/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  OutputValues,
  NodeDescriptor,
} from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";

export type SlotNodeInputs = {
  slot: string;
  parent: NodeDescriptor;
};

export default {
  metadata: {
    deprecated: true,
  },
  describe: async (inputs?: InputValues) => ({
    inputSchema: new SchemaBuilder()
      .setAdditionalProperties(true)
      .addInputs(inputs)
      .addProperty("slot", {
        title: "slot",
        description: "The slot to run.",
        type: "string",
      })
      .build(),
    outputSchema: new SchemaBuilder().setAdditionalProperties(true).build(),
  }),
  invoke: async (): Promise<OutputValues> => {
    throw new Error("Slot node is deprecated.");
  },
};
