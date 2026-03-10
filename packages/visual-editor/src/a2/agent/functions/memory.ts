/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlerContext } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { llm, toText } from "../../a2/utils.js";
import { AgentFileSystem } from "../file-system.js";
import { assembleFunctionGroup } from "../function-definition.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { FunctionGroup, MemoryManager } from "../types.js";
import { TaskTreeManager } from "../task-tree-manager.js";

import {
  declarations,
  metadata,
  instruction,
  type MemoryCreateSheetParams,
  type MemoryReadSheetParams,
  type MemoryUpdateSheetParams,
  type MemoryDeleteSheetParams,
  type MemoryGetMetadataParams,
} from "./generated/memory.js";

export { getMemoryFunctionGroup };

export type MemoryFunctionArgs = {
  context: NodeHandlerContext;
  translator: PidginTranslator;
  fileSystem: AgentFileSystem;
  memoryManager: MemoryManager;
  taskTreeManager: TaskTreeManager;
};

function getMemoryFunctionGroup(args: MemoryFunctionArgs): FunctionGroup {
  const { context, translator, fileSystem, memoryManager, taskTreeManager } =
    args;

  return assembleFunctionGroup(declarations, metadata, instruction, {
    memory_create_sheet: async ({
      task_id,
      status_update,
      ...parameters
    }: MemoryCreateSheetParams) => {
      taskTreeManager.setInProgress(task_id, status_update);
      const result = await memoryManager.createSheet(context, parameters);
      if (!ok(result)) return { error: result.$error };
      return result;
    },

    memory_read_sheet: async (args: MemoryReadSheetParams) => {
      const { output_format, file_name, status_update, task_id, ...rest } =
        args;
      taskTreeManager.setInProgress(task_id, status_update);
      const result = await memoryManager.readSheet(context, rest);
      if (!ok(result)) return { error: result.$error };
      const parts = llm`${result}`.asParts().at(0);
      if (!parts) {
        return { error: "The sheet is empty" };
      }
      const file_path = fileSystem.add(parts, file_name);
      if (!ok(file_path)) return { error: file_path.$error };
      if (output_format === "file") {
        return { file_path };
      }
      return { json: JSON.stringify(result) };
    },

    memory_update_sheet: async ({
      range,
      values: pidginValues,
      task_id,
    }: MemoryUpdateSheetParams) => {
      taskTreeManager.setInProgress(task_id, "");
      const errors: string[] = [];
      const values = await Promise.all(
        pidginValues.map(async (list) => {
          return await Promise.all(
            list.map(async (value) => {
              const translated = await translator.fromPidginString(value);
              if (!ok(translated)) {
                errors.push(translated.$error);
                return "";
              }
              return toText(translated);
            })
          );
        })
      );
      if (errors.length > 0) {
        return { error: errors.join(", ") };
      }
      const result = await memoryManager.updateSheet(context, {
        range,
        values,
      });
      if (!ok(result)) return { error: result.$error };
      return result;
    },

    memory_delete_sheet: async ({
      task_id,
      status_update,
      ...parameters
    }: MemoryDeleteSheetParams) => {
      taskTreeManager.setInProgress(task_id, status_update);
      const result = await memoryManager.deleteSheet(context, parameters);
      if (!ok(result)) return { error: result.$error };
      return result;
    },

    memory_get_metadata: async ({
      task_id,
      status_update,
    }: MemoryGetMetadataParams) => {
      taskTreeManager.setInProgress(task_id, status_update);
      const result = await memoryManager.getSheetMetadata(context);
      if (!ok(result)) return { error: result.$error };
      return result;
    },
  });
}
