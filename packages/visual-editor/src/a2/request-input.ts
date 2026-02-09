/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Outcome, OutputValues, Schema } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import type { A2ModuleArgs } from "./runnable-module-factory.js";

export { requestInput };

/**
 * Requests input from the user by going directly through the ConsoleEntry.
 *
 * This replaces `caps.input({ schema })` with a direct call that bypasses
 * the Capabilities layer entirely. The ConsoleEntry creates a WorkItem,
 * notifies the parent ProjectRun, and returns a Promise that resolves
 * when the user provides values.
 */
async function requestInput(
  args: A2ModuleArgs,
  schema: Schema
): Promise<Outcome<OutputValues>> {
  const { currentStep, getProjectRunState } = args.context;
  const stepId = currentStep?.id;
  const entry = stepId && getProjectRunState?.()?.console.get(stepId);
  if (!entry) {
    return err(
      `Unable to request input: no console entry found for node "${stepId}"`
    );
  }
  return entry.requestInput(schema);
}
