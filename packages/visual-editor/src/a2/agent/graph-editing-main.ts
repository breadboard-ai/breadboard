/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { Loop, AgentResult } from "./loop.js";
import { createGraphEditingConfigurator } from "./graph-editing-configurator.js";
import type { GraphEditingActions } from "../runnable-module-factory.js";

export { invokeGraphEditingAgent };

/**
 * Creates and runs a graph editing agent loop.
 *
 * Unlike the content generation agent (which is invoked as a graph step),
 * this agent is designed to be triggered from the visual editor UI to help
 * users build and modify graphs through conversation.
 */
async function invokeGraphEditingAgent(
  objective: LLMContent,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  graphEditingActions: GraphEditingActions
): Promise<Outcome<AgentResult>> {
  const configureFn = createGraphEditingConfigurator(graphEditingActions);
  const loop = new Loop(caps, moduleArgs, configureFn);
  return loop.run({
    objective,
    params: {},
    uiType: "chat",
  });
}
