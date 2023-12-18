/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  OutputValues,
  NodeHandlerContext,
  NodeDescriptor,
} from "@google-labs/breadboard";
import { BoardRunner } from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";

export type SlotNodeInputs = {
  slot: string;
  parent: NodeDescriptor;
};

export default {
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
  invoke: async (
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> => {
    const { slot, ...args } = inputs as SlotNodeInputs;
    if (!slot) throw new Error("To use a slot, we need to specify its name");
    const graph = context.slots && context.slots[slot];
    if (!graph) throw new Error(`No graph found for slot "${slot}"`);
    const slottedBreadboard = await BoardRunner.fromGraphDescriptor(graph);
    return await slottedBreadboard.runOnce(args, context);
  },
};
