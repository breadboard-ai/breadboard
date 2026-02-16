/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getGraphEditingFunctionGroup } from "./functions.js";
import type { FunctionGroup } from "../types.js";
import { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import { getChatFunctionGroup } from "./chat-functions.js";

export { buildGraphEditingFunctionGroups };

/**
 * Builds the function groups for the graph editing agent.
 *
 * Creates a shared `EditingAgentPidginTranslator` that accumulates
 * handle maps across function calls within a session.
 */
function buildGraphEditingFunctionGroups(args: {
  waitForInput: (agentMessage: string) => Promise<string>;
}): FunctionGroup[] {
  const translator = new EditingAgentPidginTranslator();
  return [
    getGraphEditingFunctionGroup(translator),
    getChatFunctionGroup(args.waitForInput, translator),
  ];
}
