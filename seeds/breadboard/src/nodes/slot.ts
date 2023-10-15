/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  OutputValues,
  NodeHandlerContext,
  SlotNodeInputs,
} from "../types.js";
import { BoardRunner } from "../runner.js";
import { SchemaBuilder } from "../schema.js";

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
    const graph = context.slots[slot];
    if (!graph) throw new Error(`No graph found for slot "${slot}"`);
    const slottedBreadboard = await BoardRunner.fromGraphDescriptor(graph);
    return await slottedBreadboard.runOnce(args, context);
  },
};
