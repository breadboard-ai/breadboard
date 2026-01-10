/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { defineFunction, FunctionDefinition } from "../function-definition.js";
import { ChatManager } from "../types.js";
import { ok } from "@breadboard-ai/utils/outcome.js";

export { defineChatFunctions, CHAT_REQUEST_USER_INPUT };

const CHAT_REQUEST_USER_INPUT = "chat_request_user_input";

export type ChatFunctionsArgs = {
  chatManager: ChatManager;
};

function defineChatFunctions(args: ChatFunctionsArgs): FunctionDefinition[] {
  return [
    defineFunction(
      {
        name: CHAT_REQUEST_USER_INPUT,
        description:
          "Requests input from user. Call this function to hold a conversatio with the user. Each call corresponds to a conversation turn. Use only when necessary to fulfill the objective.",
        parameters: {
          user_message: z
            .string()
            .describe(
              `Message to display to the user when requesting input. The content may include references to VFS files using <file src="/vfs/name.ext" /> tags.`
            ),
        },
        response: {
          user_input: z.string().describe(`Response from the user`),
        },
      },
      async ({ user_message }) => {
        const chatResponse = await args.chatManager.chat(user_message);
        if (!ok(chatResponse)) return chatResponse;
        return { user_input: chatResponse.text };
      }
    ),
  ];
}
