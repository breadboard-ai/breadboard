/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { Loop, AgentResult } from "../loop.js";
import { buildGraphEditingFunctionGroups } from "./configurator.js";
import { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import { graphOverviewYaml } from "./graph-overview.js";
import type { LoopHooks } from "../types.js";
import type { AgentEventSink } from "../agent-event-sink.js";
import type { ReadGraphResponse } from "./types.js";

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
  sink: AgentEventSink,
  hooks?: LoopHooks
): Promise<Outcome<AgentResult>> {
  const translator = new EditingAgentPidginTranslator();
  const functionGroups = buildGraphEditingFunctionGroups({
    sink,
    translator,
  });

  // Read the current graph via suspend so the agent knows the state.
  const { graph } = await sink.suspend<ReadGraphResponse>({
    type: "readGraph",
    requestId: crypto.randomUUID(),
  });

  const overview = graphOverviewYaml(
    graph,
    graph.nodes ?? [],
    graph.edges ?? [],
    translator
  );

  // TODO: Selection info comes from the controller — needs a suspend event
  // for "readSelection" or similar. For now, skip selection info.
  const selectionInfo = "";

  objective = {
    parts: [
      ...objective.parts,
      { text: `\n\nCurrent graph:\n${overview}${selectionInfo}` },
    ],
  };

  const loop = new Loop(moduleArgs);

  return loop.run({
    objective,
    functionGroups,
    hooks,
  });
}
