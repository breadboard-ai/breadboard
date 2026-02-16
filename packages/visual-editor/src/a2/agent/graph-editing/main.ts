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
  const translator = new EditingAgentPidginTranslator();
  const functionGroups = buildGraphEditingFunctionGroups({
    waitForInput,
    translator,
  });

  // Inject the current graph overview and selection into the objective
  // so the agent knows the graph state from the start.
  const { controller } = bind;
  const editor = controller.editor.graph.editor;
  if (editor) {
    const graph = editor.raw();
    const overview = graphOverviewYaml(
      graph,
      graph.nodes ?? [],
      graph.edges ?? [],
      translator
    );

    const selectedNodes = controller.editor.selection.selection.nodes;
    const selectionInfo = describeSelection(
      selectedNodes,
      graph.nodes ?? [],
      translator
    );

    objective = {
      parts: [
        ...objective.parts,
        { text: `\n\nCurrent graph:\n${overview}${selectionInfo}` },
      ],
    };
  }

  const loop = new Loop(moduleArgs);

  return loop.run({
    objective,
    functionGroups,
    hooks,
  });
}
