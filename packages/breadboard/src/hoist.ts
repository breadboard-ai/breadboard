/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputStageResult, RunResult } from "./run.js";
import {
  NodeDescriptor,
  NodeHandlerContext,
  OutputValues,
  Schema,
  TraversalResult,
} from "./types.js";

export const hoistOutputIfNeeded = async (
  outputs: OutputValues,
  descriptor: NodeDescriptor,
  context: NodeHandlerContext
): Promise<boolean> => {
  if (!context.provideOutput) return false;
  const schema = descriptor.configuration?.schema as Schema;
  const shouldHoist = schema?.hints?.includes("hoist");
  if (!shouldHoist) return false;

  await context.provideOutput(outputs, descriptor);
  return true;
};

export const createOutputProvider = (
  next: (result: RunResult) => Promise<void>,
  result: TraversalResult
) => {
  return async (outputs: OutputValues, descriptor: NodeDescriptor) => {
    const provideOutputResult = {
      ...result,
      descriptor,
      inputs: outputs,
    };
    console.log("hoisting", outputs, descriptor);
    await next(new OutputStageResult(provideOutputResult, -1));
  };
};
