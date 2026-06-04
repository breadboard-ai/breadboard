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
import { graphOverviewYaml, describeSelection } from "./graph-overview.js";
import { bind } from "../../../sca/actions/graph/graph-actions.js";
import type { LoopHooks } from "../types.js";
import type { AgentEventSink } from "../agent-event-sink.js";
import { readGraph } from "./read-graph.js";

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
  translator: EditingAgentPidginTranslator,
  hooks?: LoopHooks,
  productName = "Opal"
): Promise<Outcome<AgentResult>> {
  const functionGroups = buildGraphEditingFunctionGroups({
    sink,
    translator,
    productName,
  });

  // Read the current graph via suspend so the agent knows the state.
  const graph = await readGraph(sink);

  let overview = "";
  let selectionInfo = "";
  try {
    const { controller } = bind;
    const canvas = controller?.editor?.canvas;

    overview = graphOverviewYaml(
      graph,
      graph.nodes ?? [],
      graph.edges ?? [],
      translator,
      canvas ?? null
    );

    const selectedNodes = controller?.editor?.selection?.selection?.nodes;
    if (selectedNodes && graph.nodes) {
      selectionInfo = describeSelection(selectedNodes, graph.nodes, translator);
    }
  } catch {
    // Gracefully fallback if bind hasn’t set the controller yet
    overview = graphOverviewYaml(
      graph,
      graph.nodes ?? [],
      graph.edges ?? [],
      translator,
      null
    );
  }

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
