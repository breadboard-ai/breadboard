/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@breadboard-ai/utils/outcome.js";
import z from "zod";
import { tr } from "../../a2/utils.js";
import {
  defineFunction,
  FunctionDefinition,
  mapDefinitions,
} from "../function-definition.js";
import { ChatManager, FunctionGroup, VALID_INPUT_TYPES } from "../types.js";
import { PidginTranslator } from "../pidgin-translator.js";

export { getChatFunctionGroup, CHAT_LOG_VFS_PATH };

const CHAT_REQUEST_USER_INPUT = "chat_request_user_input";
const CHAT_LOG_VFS_PATH = "/vfs/system/chat_log.json";

export type ChatFunctionsArgs = {
  chatManager: ChatManager;
  translator: PidginTranslator;
};

const instruction = tr`

## Interacting with the User

Use the "${CHAT_REQUEST_USER_INPUT}" function to interact with the user via a chat-like UI. Every function call is equivalent to a full conversation turn: your request, then user's input.

The chat log is maintained automatically at the VFS file "${CHAT_LOG_VFS_PATH}".

Structure the requests to anticipate user's answers and minimize the amount of typing they need to do. If appropriate, offer choices, so that the user can just enter the letter and/or number of the choices.

If the user input requires multiple entries, split the conversation into multiple turns. For example, if you have three questions to ask, ask them over three full conversation turns (three calls to "${CHAT_REQUEST_USER_INPUT}" function) rather than in one call.

The user does not need to see a wall of text and dread typing back another wall of text as their input.

`;

function getChatFunctionGroup(args: ChatFunctionsArgs): FunctionGroup {
  return { ...mapDefinitions(defineChatFunctions(args)), instruction };
}

function defineChatFunctions(args: ChatFunctionsArgs): FunctionDefinition[] {
  return [
    defineFunction(
      {
        name: CHAT_REQUEST_USER_INPUT,
        description: tr`
Requests input from user. Call this function to hold a conversatio with the user. Each call corresponds to a conversation turn. Use only when necessary to fulfill the objective.
`,
        parameters: {
          user_message: z.string().describe(
            tr`
Message to display to the user when requesting input. The content may include references to VFS files using <file src="/vfs/name.ext" /> tags.
`
          ),
          input_type: z
            .enum(VALID_INPUT_TYPES)
            .describe(
              tr`
Input type hint, which allows to better present the chat user interface. If not specified, all kinds of inputs are accepted. When "text" is specified, the chat input is constrained to accept text only. If "file-upload" is specified, the input only allows uploading files.

Unless the objective explicitly asks for a particular type of input, use the "any" value for "input_type" parameter, which does not constrain the input.
`
            )
            .default("any"),
        },
        response: {
          user_input: z.string().describe(`Response from the user`),
        },
      },
      async ({ user_message, input_type }) => {
        const chatResponse = await args.chatManager.chat(
          user_message,
          input_type
        );
        if (!ok(chatResponse)) return chatResponse;
        const { input } = chatResponse;
        const pidgin = await args.translator.toPidgin(input, {});
        if (!ok(pidgin)) return pidgin;
        return { user_input: pidgin.text };
      }
    ),
  ];
}
