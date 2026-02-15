/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { Loop, AgentResult } from "./loop.js";
import { buildGraphEditingFunctionGroups } from "./graph-editing-configurator.js";
import type { GraphEditingActions } from "../runnable-module-factory.js";

export { invokeGraphEditingAgent };

/**
 * Creates and runs a graph editing agent loop.
 *
 * Unlike the content generation agent (which uses buildAgentRun for full
 * infrastructure), this agent uses the Loop directly with minimal setup —
 * no pidgin translation, no run state, no progress UI, no termination
 * callbacks. The loop runs until the signal aborts it.
 */
async function invokeGraphEditingAgent(
  objective: LLMContent,
  moduleArgs: A2ModuleArgs,
  graphEditingActions: GraphEditingActions
): Promise<Outcome<AgentResult>> {
  const functionGroups = buildGraphEditingFunctionGroups({
    graphEditingActions,
  });
  const loop = new Loop(moduleArgs);

  return loop.run({
    objective,
    functionGroups,
  });
}
