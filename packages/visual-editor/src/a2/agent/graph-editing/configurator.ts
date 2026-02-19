/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getGraphEditingFunctionGroup } from "./functions.js";
import type { FunctionGroup } from "../types.js";
import type { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import { getChatFunctionGroup } from "./chat-functions.js";
import type { AgentEventSink } from "../agent-event-sink.js";

export { buildGraphEditingFunctionGroups };

/**
 * Builds the function groups for the graph editing agent.
 *
 * Receives a shared `EditingAgentPidginTranslator` that accumulates
 * handle maps across function calls within a session.
 */
function buildGraphEditingFunctionGroups(args: {
  sink: AgentEventSink;
  translator: EditingAgentPidginTranslator;
}): FunctionGroup[] {
  const { translator } = args;
  return [
    getGraphEditingFunctionGroup(translator),
    getChatFunctionGroup(args.sink, translator),
  ];
}
