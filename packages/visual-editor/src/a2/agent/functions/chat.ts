/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@breadboard-ai/utils/outcome.js";
import z from "zod";
import { tr } from "../../a2/utils.js";
import { defineFunction, FunctionDefinition } from "../function-definition.js";
import { ChatManager, VALID_INPUT_TYPES } from "../types.js";
import { PidginTranslator } from "../pidgin-translator.js";

export { CHAT_REQUEST_USER_INPUT, defineChatFunctions };

const CHAT_REQUEST_USER_INPUT = "chat_request_user_input";

export type ChatFunctionsArgs = {
  chatManager: ChatManager;
  translator: PidginTranslator;
};

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
Input type hint, which allows to better present the chat user interface. If not specified, all kinds of inputs are accepted. When "text" is specified, the chat input is constrained to accept text only. If "file-upload" is specified, the input only allows uploading files. If "camera" or "microphone" specified, the input is constrained to only allow camera or microphone input, respectively.

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
