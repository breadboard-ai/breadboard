/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { getGraphEditingFunctionGroup } from "./functions/graph-editing.js";
import { defineFunction, mapDefinitions } from "./function-definition.js";
import type { FunctionGroup } from "./types.js";

export { buildGraphEditingFunctionGroups };

/**
 * Builds the function groups for the graph editing agent.
 *
 * Unlike the content generation agent (which uses `FunctionGroupConfigurator`
 * for its complex deps), this is a plain function that returns groups directly.
 * The graph editing agent has no file system, pidgin, or run state.
 */
function buildGraphEditingFunctionGroups(args: {
  waitForInput: (agentMessage: string) => Promise<string>;
}): FunctionGroup[] {
  return [
    getGraphEditingFunctionGroup(),
    getChatFunctionGroup(args.waitForInput),
  ];
}

/**
 * A minimal chat function group for the persistent graph editing agent.
 * Contains a single `wait_for_user_input` function that blocks until
 * the user sends the next message.
 */
function getChatFunctionGroup(
  waitForInput: (agentMessage: string) => Promise<string>
): FunctionGroup {
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
        },
      },
      async ({ message }) => {
        const userMessage = await waitForInput(message);
        return { user_message: userMessage };
      }
    ),
  ];

  return {
    ...mapDefinitions(functions),
    instruction: `## Conversation Flow

After completing each user request, always call "wait_for_user_input" to receive the next instruction. Use the message parameter to tell the user what you did. Never stop without calling it — the conversation is ongoing.`,
  };
}
