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
import {
  ChatChoice,
  ChatChoiceLayout,
  ChatChoiceSelectionMode,
  ChatManager,
  FunctionGroup,
  VALID_INPUT_TYPES,
} from "../types.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { taskIdSchema } from "./system.js";
import { TaskTreeManager } from "../task-tree-manager.js";

export { getChatFunctionGroup, CHAT_LOG_PATH };

const CHAT_REQUEST_USER_INPUT = "chat_request_user_input";
const CHAT_PRESENT_CHOICES = "chat_present_choices";
const CHAT_LOG_PATH = "/mnt/system/chat_log.json";
const NONE_OF_THE_ABOVE_ID = "__none_of_the_above__";

export type ChatFunctionsArgs = {
  chatManager: ChatManager;
  translator: PidginTranslator;
  taskTreeManager: TaskTreeManager;
};

const instruction = tr`

## Interacting with the User

Use the "${CHAT_PRESENT_CHOICES}" function when you have a discrete set of options for the user to choose from. This provides a better user experience than asking them to type their selection.

Use the "${CHAT_REQUEST_USER_INPUT}" function for freeform text input or file uploads.

Prefer structured choices over freeform input when the answer space is bounded.

The chat log is maintained automatically at the file "${CHAT_LOG_PATH}".

If the user input requires multiple entries, split the conversation into multiple turns. For example, if you have three questions to ask, ask them over three full conversation turns rather than in one call.

`;

function getChatFunctionGroup(args: ChatFunctionsArgs): FunctionGroup {
  return { ...mapDefinitions(defineChatFunctions(args)), instruction };
}

const VALID_SELECTION_MODES: ChatChoiceSelectionMode[] = ["single", "multiple"];

function defineChatFunctions(args: ChatFunctionsArgs): FunctionDefinition[] {
  return [
    defineFunction(
      {
        name: CHAT_REQUEST_USER_INPUT,
        title: "Asking the user",
        icon: "chat_bubble",
        description: tr`
Requests input from user. Call this function to hold a conversatio with the user. Each call corresponds to a conversation turn. Use only when necessary to fulfill the objective.
`,
        parameters: {
          user_message: z.string().describe(
            tr`
Message to display to the user when requesting input. The content may include references to files using <file src="/mnt/name.ext" /> tags.
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
          ...taskIdSchema,
        },
        response: {
          user_input: z.string().describe(`Response from the user`),
        },
      },
      async ({ user_message, input_type, task_id }) => {
        args.taskTreeManager.setInProgress(task_id, "");
        const chatResponse = await args.chatManager.chat(
          user_message,
          input_type
        );
        if (!ok(chatResponse)) return chatResponse;
        const { input } = chatResponse;
        const pidgin = await args.translator.toPidgin(input, {}, true);
        if (!ok(pidgin)) return pidgin;
        return { user_input: pidgin.text };
      }
    ),
    defineFunction(
      {
        name: CHAT_PRESENT_CHOICES,
        title: "Presenting Choices to the User",
        icon: "list",
        description: tr`
Presents the user with a set of choices to select from. Use when you need the user to make a decision from a predefined set of options. 
`,
        parameters: {
          user_message: z.string().describe(
            tr`
Message explaining what the user should choose. The content may include references to files using <file src="/mnt/name.ext" /> tags.
`
          ),
          choices: z
            .array(
              z.object({
                id: z.string().describe(`Unique identifier for this choice`),
                label: z
                  .string()
                  .describe(
                    `Display text for the choice. The content may include references to files using <file src="/mnt/name.ext" /> tags.`
                  ),
              })
            )
            .describe(`The choices to present to the user`),
          selection_mode: z.enum(VALID_SELECTION_MODES).describe(
            tr`
"single" for choose-one (radio buttons), "multiple" for any-of (checkboxes).
`
          ),
          layout: z
            .enum(["list", "row", "grid"])
            .optional()
            .default("list")
            .describe(
              tr`
Layout hint for displaying choices:
- "list" (default): Vertical stack, best for longer choice labels
- "row": Horizontal inline, best for short choices like "Yes/No" or side-by-side comparisons (e.g. images)
- "grid": Wrapping grid that adapts to available space
`
            ),
          none_of_the_above_label: z
            .string()
            .optional()
            .describe(
              tr`If provided, adds a visually distinct "none of the above" escape option with this label (e.g., "Exit", "Skip", "Try Again"). Rendered below a separator with secondary styling. When selected, returns ID "${NONE_OF_THE_ABOVE_ID}". Best suited for single selection mode; in multiple mode it behaves as a regular checkbox.`
            ),
          ...taskIdSchema,
        },
        response: {
          selected: z
            .array(z.string())
            .describe(
              `Array of selected choice IDs. For "single" mode, this will have exactly one element.`
            ),
        },
      },
      async ({
        user_message,
        choices,
        selection_mode,
        layout,
        none_of_the_above_label,
        task_id,
      }) => {
        args.taskTreeManager.setInProgress(task_id, "");
        const choicesResponse = await args.chatManager.presentChoices(
          user_message,
          choices as ChatChoice[],
          selection_mode as ChatChoiceSelectionMode,
          layout as ChatChoiceLayout,
          none_of_the_above_label
        );
        if (!ok(choicesResponse)) return choicesResponse;
        return { selected: choicesResponse.selected };
      }
    ),
  ];
}
