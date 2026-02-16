/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { defineFunction, mapDefinitions } from "../function-definition.js";
import type { FunctionGroup } from "../types.js";
import type { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import { bind } from "../../../sca/actions/graph/graph-actions.js";
import { graphOverviewYaml } from "./graph-overview.js";
import {
  takeSnapshot,
  diffSnapshots,
  type GraphSnapshot,
} from "./graph-diff.js";

export { getChatFunctionGroup };

/**
 * Read the current graph data from the active editor.
 */
function getGraphData() {
  const { controller } = bind;
  const editor = controller.editor.graph.editor;
  if (!editor) return null;
  const graph = editor.raw();
  return {
    title: graph.title,
    description: graph.description,
    nodes: graph.nodes ?? [],
    edges: graph.edges ?? [],
  };
}

/**
 * A chat function group for the persistent graph editing agent.
 * Contains a single `wait_for_user_input` function that blocks until
 * the user sends the next message.
 *
 * When the user responds, the function also reports any graph changes
 * the user made while the agent was waiting.
 */
function getChatFunctionGroup(
  waitForInput: (agentMessage: string) => Promise<string>,
  translator: EditingAgentPidginTranslator
): FunctionGroup {
  let lastSnapshot: GraphSnapshot | null = null;

  const functions = [
    defineFunction(
      {
        name: "wait_for_user_input",
        title: "Waiting for input",
        icon: "hourglass_empty",
        description:
          "Wait for the next message from the user. Use the message parameter to greet the user or report what you've done before waiting.",
        parameters: {
          message: z
            .string()
            .describe(
              "A message to display to the user, e.g. a greeting or a summary of what you just did."
            ),
        },
        response: {
          user_message: z.string().describe("The user's message"),
          graph_changes: z
            .string()
            .optional()
            .describe(
              "If the user edited the graph while you were waiting, describes what changed. Includes the current graph overview. Absent if no changes were made."
            ),
        },
      },
      async ({ message }) => {
        // Snapshot the graph before blocking on user input.
        const beforeData = getGraphData();
        if (beforeData) {
          lastSnapshot = takeSnapshot(
            beforeData.nodes,
            beforeData.edges,
            translator
          );
        }

        const userMessage = await waitForInput(message);

        // After user responds, check whether they edited the graph.
        const afterData = getGraphData();
        let graph_changes: string | undefined;

        if (lastSnapshot && afterData) {
          const currentSnapshot = takeSnapshot(
            afterData.nodes,
            afterData.edges,
            translator
          );
          const diff = diffSnapshots(lastSnapshot, currentSnapshot);
          if (diff) {
            const overview = graphOverviewYaml(
              afterData,
              afterData.nodes,
              afterData.edges,
              translator
            );
            graph_changes = `${diff}\n\nCurrent graph:\n${overview}`;
          }
          lastSnapshot = currentSnapshot;
        }

        return {
          user_message: userMessage,
          ...(graph_changes ? { graph_changes } : {}),
        };
      }
    ),
  ];

  return {
    ...mapDefinitions(functions),
    instruction: `## Conversation Flow

After completing each user request, always call "wait_for_user_input" to receive the next instruction. Use the message parameter to tell the user what you did. Never stop without calling it — the conversation is ongoing.

When the response includes "graph_changes", the user manually edited the graph while you were waiting. Acknowledge those changes naturally — for example, "I see you added a new step" or "Looks like you changed the title of the Research step." Then address their message.`,
  };
}
