/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlerContext } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import z from "zod";
import { llm, toText, tr } from "../../a2/utils.js";
import { AgentFileSystem } from "../file-system.js";
import {
  defineFunction,
  FunctionDefinition,
  mapDefinitions,
} from "../function-definition.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { FunctionGroup, MemoryManager } from "../types.js";
import { statusUpdateSchema, taskIdSchema } from "./system.js";
import { TaskTreeManager } from "../task-tree-manager.js";
import { CHAT_LOG_PATH } from "./chat.js";

export { getMemoryFunctionGroup };

const MEMORY_CREATE_SHEET_FUNCTION = "memory_create_sheet";
const MEMORY_READ_SHEET_FUNCTION = "memory_read_sheet";
const MEMORY_UPDATE_SHEET_FUNCTION = "memory_update_sheet";
const MEMORY_DELETE_SHEET_FUNCTION = "memory_delete_sheet";
const MEMORY_GET_METADATA_FUNCTION = "memory_get_metadata";

export type MemoryFunctionArgs = {
  context: NodeHandlerContext;
  translator: PidginTranslator;
  fileSystem: AgentFileSystem;
  memoryManager: MemoryManager;
  taskTreeManager: TaskTreeManager;
};

const instruction = tr`

## Using memory data store

You have access to a persistent data store that allows you to recall and remember data across multiple sessions. Use the data store when the objective contains the key phrase "Use Memory".

The data store is stored in a Google Spreadsheet. 

Unless the objective explicitly calls for creating new sheets and  specifies names for them, keep all memory data in a single sheet named "memory". Populate it with the columns that make sense for a wide range of data. Typically, you will want to include "Date", "Title", and "Details" columns. Look at the objective for hints on what columns to use. If there is a sheet that already exists, reuse it instead of creating a new one.

Create new sheets within this spreadsheet using the "${MEMORY_CREATE_SHEET_FUNCTION}" function and delete sheets with the "${MEMORY_DELETE_SHEET_FUNCTION}" function. Get the list of existing sheets with the "${MEMORY_GET_METADATA_FUNCTION}" function.

To retrieve data from memory, use either the "${MEMORY_READ_SHEET_FUNCTION}" function with the standard Google Sheets ranges or read the entire sheet as a file using the "/mnt/memory/sheet_name" path.

To update data in memory, use the "${MEMORY_UPDATE_SHEET_FUNCTION}" function.

The full transcript of the conversation with the user is automatically stored in a separate data store. Don't call any functions when asked to store chat logs or chat information. Just read the chat log from "${CHAT_LOG_PATH}" whenever you need the chat history.`;

function getMemoryFunctionGroup(args: MemoryFunctionArgs): FunctionGroup {
  return {
    ...mapDefinitions(defineMemoryFunctions(args)),
    instruction,
  };
}

function defineMemoryFunctions(args: MemoryFunctionArgs): FunctionDefinition[] {
  const { context, translator, fileSystem, memoryManager, taskTreeManager } =
    args;
  return [
    defineFunction(
      {
        name: MEMORY_CREATE_SHEET_FUNCTION,
        icon: "table_chart",
        title: "Creating a new memory sheet",
        description: "Creates a new memory sheet",
        parameters: {
          name: z.string().describe(tr`The name of the sheet. Use snake_case for
naming.`),
          columns: z
            .array(z.string().describe(tr`The name of the column header`))
            .describe(
              tr`
An array of strings representing the column headers (e.g., ['Name', 'Status']).`
            ),
          ...taskIdSchema,
          ...statusUpdateSchema,
        },
      },
      async ({ task_id, status_update, ...parameters }) => {
        taskTreeManager.setInProgress(task_id, status_update);
        const result = await memoryManager.createSheet(context, parameters);
        if (!ok(result)) return { error: result.$error };
        return result;
      }
    ),
    defineFunction(
      {
        name: MEMORY_READ_SHEET_FUNCTION,
        icon: "table_chart",
        title: "Reading memory",
        description: tr`
Reads values from a specific memory range (e.g. Scores!A1:B3)`,
        parameters: {
          range: z.string().describe(tr`
The Google Sheets range which must include the name of the sheet
`),
          file_name: z
            .string()
            .describe(
              tr`

The name of the file to save the output to. This is the name that
will come after "/mnt/" prefix in the file path. Use snake_case for
naming. Only use when the "output_format" is set to "file".`
            )
            .optional(),
          output_format: z.enum(["file", "json"]).describe(tr`

The output format. When "file" is specified, the output will be saved as a file and the "file_path" response parameter will be provided as output. Use this when you expect a long output from the sheet. NOTE that choosing this option will prevent you from seeing the output directly: you only get back the file path. You can read this file as a separate action, but if you do expect to read it, the "json" output format might be a better choice.

When "json" is specified, the output will be returned as JSON directlty, and the "json" response parameter will be provided.`),
          ...taskIdSchema,
          ...statusUpdateSchema,
        },
        response: {
          file_path: z
            .string()
            .describe(
              `The file path with the output of the
generator. Will be provided when the "output_format" is set to "file"`
            )
            .optional(),
          json: z
            .string()
            .describe(
              `The JSON output of the generator. Will be 
provided when the "output_format" is set to "json"`
            )
            .optional(),
          error: z
            .string()
            .describe(
              `If an error has occurred, will contain a description of the error`
            )
            .optional(),
        },
      },
      async (args) => {
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
      }
    ),
    defineFunction(
      {
        name: MEMORY_UPDATE_SHEET_FUNCTION,
        title: "Updating memory",
        icon: "table_chart",
        description: tr`
Overwrites a specific memory range with new data. Used for editing specific rows.
`,
        parameters: {
          range: z.string().describe(tr`
The Google Sheets range which must include the name of the sheet
`),
          values: z.array(
            z.array(
              z.string().describe(
                tr`
The data to write, may include references to files. For instance, if you have an existing file at "/mnt/text3.md", you can reference it as <file src="/mnt/text3.md" /> in the in data. At update time, the tag will be replaced with the file contents.`
              )
            )
          ).describe(tr`
The 2D array of data to write.
`),
          ...taskIdSchema,
        },
      },
      async ({ range, values: pidginValues, task_id }) => {
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
      }
    ),
    defineFunction(
      {
        name: MEMORY_DELETE_SHEET_FUNCTION,
        icon: "table_chart",
        title: "Deleting a memory sheet",
        description: tr`
Deletes a specific memory sheet`,
        parameters: {
          name: z.string().describe(tr`The name of the sheet`),
          ...taskIdSchema,
          ...statusUpdateSchema,
        },
      },
      async ({ task_id, status_update, ...parameters }) => {
        taskTreeManager.setInProgress(task_id, status_update);
        const result = await memoryManager.deleteSheet(context, parameters);
        if (!ok(result)) return { error: result.$error };
        return result;
      }
    ),
    defineFunction(
      {
        name: MEMORY_GET_METADATA_FUNCTION,
        icon: "table_chart",
        title: "Reading memory metadata",
        description: tr`
Returns the names and header rows of all memory sheets.`,
        parameters: {
          ...taskIdSchema,
          ...statusUpdateSchema,
        },
        response: {
          sheets: z
            .array(
              z.object({
                name: z.string().describe(tr`
The name of the memory sheet
`),
                file_path: z.string().describe(tr`
The file path to read the memory sheet
`),
                columns: z.array(
                  z.string().describe(tr`
The column name
`)
                ).describe(tr`
The list of column names
`),
              })
            )
            .optional(),
          error: z
            .string()
            .describe(
              `If an error has occurred, will contain a description of the error`
            )
            .optional(),
        },
      },
      async ({ task_id, status_update }) => {
        taskTreeManager.setInProgress(task_id, status_update);
        const result = await memoryManager.getSheetMetadata(context);
        if (!ok(result)) return { error: result.$error };
        return result;
      }
    ),
  ];
}
