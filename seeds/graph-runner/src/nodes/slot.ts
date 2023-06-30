/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphTraversalContext, InputValues, OutputValues } from "../types.js";

type SlotInput = {
  slot: string;
  args: InputValues;
};

export default async (
  context: GraphTraversalContext,
  { slot, ...args }: SlotInput
): Promise<OutputValues> => {
  if (!slot) throw new Error("To use a slot, we need to specify its name");
  return await context.requestSlotOutput(slot, args);
};
