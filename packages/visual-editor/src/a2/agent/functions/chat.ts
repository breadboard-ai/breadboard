/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@breadboard-ai/utils/outcome.js";
import { assembleFunctionGroup } from "../function-definition.js";
import {
  ChatChoice,
  ChatChoiceLayout,
  ChatChoiceSelectionMode,
  ChatManager,
  FunctionGroup,
} from "../types.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { TaskTreeManager } from "../task-tree-manager.js";

import {
  declarations,
  metadata,
  instruction,
  type ChatRequestUserInputParams,
  type ChatPresentChoicesParams,
} from "./generated/chat.js";

export { getChatFunctionGroup, CHAT_LOG_PATH };

const CHAT_LOG_PATH = "/mnt/system/chat_log.json";
const SKIPPED_SENTINEL = "__skipped__";

export type ChatFunctionsArgs = {
  chatManager: ChatManager;
  translator: PidginTranslator;
  taskTreeManager: TaskTreeManager;
};

function getChatFunctionGroup(args: ChatFunctionsArgs): FunctionGroup {
  return assembleFunctionGroup(declarations, metadata, instruction, {
    chat_request_user_input: async ({
      user_message,
      input_type,
      skip_label,
      task_id,
    }: ChatRequestUserInputParams) => {
      args.taskTreeManager.setInProgress(task_id, "");
      const chatResponse = await args.chatManager.chat(
        user_message,
        input_type,
        skip_label
      );
      if (!ok(chatResponse)) return { error: chatResponse.$error };
      const { input } = chatResponse;
      // Check for the skip sentinel before pidgin translation.
      const firstText = input.parts?.find(
        (p): p is { text: string } => "text" in p
      )?.text;
      if (firstText === SKIPPED_SENTINEL) {
        return { skipped: true };
      }
      const pidgin = await args.translator.toPidgin(input, {}, true);
      if (!ok(pidgin)) return { error: pidgin.$error };
      return { user_input: pidgin.text };
    },

    chat_present_choices: async ({
      user_message,
      choices,
      selection_mode,
      layout,
      none_of_the_above_label,
      task_id,
    }: ChatPresentChoicesParams) => {
      args.taskTreeManager.setInProgress(task_id, "");
      const choicesResponse = await args.chatManager.presentChoices(
        user_message,
        choices as ChatChoice[],
        selection_mode as ChatChoiceSelectionMode,
        layout as ChatChoiceLayout,
        none_of_the_above_label
      );
      if (!ok(choicesResponse)) return { error: choicesResponse.$error };
      return { selected: choicesResponse.selected };
    },
  });
}
