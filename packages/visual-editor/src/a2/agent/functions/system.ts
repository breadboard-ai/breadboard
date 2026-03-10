/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types/data.js";
import { ok } from "@breadboard-ai/utils";
import { toText } from "../../a2/utils.js";
import { AgentFileSystem } from "../file-system.js";
import { assembleFunctionGroup } from "../function-definition.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { TaskTree, TaskTreeManager } from "../task-tree-manager.js";
import { FunctionGroup } from "../types.js";

// shared.ts previously defined Zod schemas re-exported here.
// After the declaration inversion, these are dead code.


import {
  declarations,
  metadata,
  instruction,
  type SystemObjectiveFulfilledParams,
  type SystemFailedToFulfillObjectiveParams,
  type SystemListFilesParams,
  type SystemWriteFileParams,
  type SystemReadTextFromFileParams,
  type SystemCreateTaskTreeParams,
  type SystemMarkCompletedTasksParams,
} from "./generated/system.js";

export { FAILED_TO_FULFILL_FUNCTION, getSystemFunctionGroup };

const FAILED_TO_FULFILL_FUNCTION = "system_failed_to_fulfill_objective";

export type SystemFunctionArgs = {
  fileSystem: AgentFileSystem;
  translator: PidginTranslator;
  taskTreeManager: TaskTreeManager;
  successCallback(href: string, pidginString: string): Promise<Outcome<void>>;
  failureCallback(message: string): void;
};

function getSystemFunctionGroup(args: SystemFunctionArgs): FunctionGroup {
  // The instruction template contains a {{current_date}} placeholder that
  // must be interpolated at runtime. This was previously a JS template
  // literal with `new Date().toLocaleString(...)`.
  const currentDate = new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const resolvedInstruction = instruction?.replace(
    "{{current_date}}",
    currentDate
  );

  return assembleFunctionGroup(declarations, metadata, resolvedInstruction, {
    system_objective_fulfilled: async ({
      objective_outcome,
      href,
    }: SystemObjectiveFulfilledParams) => {
      const result = await args.successCallback(
        href || "/",
        objective_outcome
      );
      if (!ok(result)) {
        return { error: result.$error };
      }
      return {};
    },

    system_failed_to_fulfill_objective: async ({
      user_message,
    }: SystemFailedToFulfillObjectiveParams) => {
      args.failureCallback(user_message);
      return {};
    },

    system_list_files: async (
      { status_update }: SystemListFilesParams,
      statusUpdate
    ) => {
      statusUpdate(status_update || "Getting a list of files");
      return { list: await args.fileSystem.listFiles() };
    },

    system_write_file: async ({
      file_name,
      content,
    }: SystemWriteFileParams) => {
      const translatedContent =
        await args.translator.fromPidginString(content);
      if (!ok(translatedContent)) {
        return { error: translatedContent.$error };
      }
      const file_path = args.fileSystem.write(
        file_name,
        toText(translatedContent)
      );
      return { file_path };
    },

    system_read_text_from_file: async ({
      file_path,
    }: SystemReadTextFromFileParams) => {
      const text = await args.fileSystem.readText(file_path);
      if (!ok(text)) return { error: text.$error };
      return { text };
    },

    system_create_task_tree: async ({
      task_tree,
    }: SystemCreateTaskTreeParams) => {
      const file_path = args.taskTreeManager.set(task_tree as TaskTree);
      return { file_path };
    },

    system_mark_completed_tasks: async ({
      task_ids,
    }: SystemMarkCompletedTasksParams) => {
      const file_path = args.taskTreeManager.setComplete(task_ids);
      return { file_path };
    },
  });
}
