/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, OutputValues } from "@google-labs/graph-runner";
import type { NodeHandlerContext, SlotNodeInputs } from "../types.js";
import { BoardRunner } from "../runner.js";

export default async (
  inputs: InputValues,
  context?: NodeHandlerContext
): Promise<OutputValues> => {
  if (!context) throw new Error("No context provided to the slot node");
  const { slot, ...args } = inputs as SlotNodeInputs;
  if (!slot) throw new Error("To use a slot, we need to specify its name");
  const graph = context.slots[slot];
  if (!graph) throw new Error(`No graph found for slot "${slot}"`);
  const slottedBreadboard = await BoardRunner.fromGraphDescriptor(graph);
  return await slottedBreadboard.runOnce(args, context);
};
