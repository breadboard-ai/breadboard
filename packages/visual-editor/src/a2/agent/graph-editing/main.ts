/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { Loop, AgentResult } from "../loop.js";
import { buildGraphEditingFunctionGroups } from "./configurator.js";
import type { LoopHooks } from "../types.js";

export { invokeGraphEditingAgent };

/**
 * Creates and runs a persistent graph editing agent loop.
 *
 * The loop runs indefinitely — the agent parks on `wait_for_user_input`
 * between interactions and resumes when the user sends a message.
 * The only way to end it is via signal abort.
 */
async function invokeGraphEditingAgent(
  objective: LLMContent,
  moduleArgs: A2ModuleArgs,
  waitForInput: (agentMessage: string) => Promise<string>,
  hooks?: LoopHooks
): Promise<Outcome<AgentResult>> {
  const functionGroups = buildGraphEditingFunctionGroups({
    waitForInput,
  });
  const loop = new Loop(moduleArgs);

  return loop.run({
    objective,
    functionGroups,
    hooks,
  });
}
