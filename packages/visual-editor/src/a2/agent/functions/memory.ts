/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err } from "@breadboard-ai/utils";
import z from "zod";
import { llm, ok, toText, tr } from "../../a2/utils.js";
import { SheetManager } from "../../google-drive/sheet-manager.js";
import { AgentFileSystem } from "../file-system.js";
import {
  defineFunction,
  FunctionDefinition,
  mapDefinitions,
} from "../function-definition.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { FunctionGroup } from "../types.js";
import { statusUpdateSchema, taskIdSchema } from "./system.js";
import { TaskTreeManager } from "../task-tree-manager.js";

export { getMemoryFunctionGroup };

const MEMORY_CREATE_SHEET_FUNCTION = "memory_create_sheet";
const MEMORY_READ_SHEET_FUNCTION = "memory_read_sheet";
const MEMORY_UPDATE_SHEET_FUNCTION = "memory_update_sheet";
const MEMORY_DELETE_SHEET_FUNCTION = "memory_delete_sheet";
const MEMORY_GET_METADATA_FUNCTION = "memory_get_metadata";

export type MemoryFunctionArgs = {
  translator: PidginTranslator;
  fileSystem: AgentFileSystem;
  memoryManager: SheetManager;
  taskTreeManager: TaskTreeManager;
};

const instruction = tr`

## Using memory

You have access to persistent memory that allows you to recall and remember data across multiple sessions.

The memory is stored in a single Google Spreadsheet. 

You can create new sheets within this spreadsheet using "${MEMORY_CREATE_SHEET_FUNCTION}" function and delete existing sheets with the "${MEMORY_DELETE_SHEET_FUNCTION}" function. You can also get the list of existing sheets with the "${MEMORY_GET_METADATA_FUNCTION}" function.

To recall, use either the "${MEMORY_READ_SHEET_FUNCTION}" function with the standard Google Sheets ranges or read the entire sheet as a VFS file using the "/vfs/memory/sheet_name" path.

To remember, use the "${MEMORY_UPDATE_SHEET_FUNCTION}" function.

`;

function getMemoryFunctionGroup(args: MemoryFunctionArgs): FunctionGroup {
  return {
    ...mapDefinitions(defineMemoryFunctions(args)),
    instruction,
  };
}

function defineMemoryFunctions(args: MemoryFunctionArgs): FunctionDefinition[] {
  const { translator, fileSystem, memoryManager, taskTreeManager } = args;
  return [
    defineFunction(
      {
        name: MEMORY_CREATE_SHEET_FUNCTION,
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
        return memoryManager.createSheet(parameters);
      }
    ),
    defineFunction(
      {
        name: MEMORY_READ_SHEET_FUNCTION,
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
will come after "/vfs/" prefix in the file path. Use snake_case for
naming. Only use when the "output_format" is set to "file".`
            )
            .optional(),
          output_format: z.enum(["file", "json"]).describe(tr`

The output format. When "file" is specified, the output will be saved as a VFS file and the "file_path" response parameter will be provided as output. Use this when you expect a long output from the sheet. NOTE that choosing this option will prevent you from seeing the output directly: you only get back the VFS path to the file. You can read this file as a separate action, but if you do expect to read it, the "json" output format might be a better choice.

When "json" is specified, the output will be returned as JSON directlty, and the "json" response parameter will be provided.`),
          ...taskIdSchema,
          ...statusUpdateSchema,
        },
        response: {
          file_path: z
            .string()
            .describe(
              `The VFS path with the output of the
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
        },
      },
      async (args) => {
        const { output_format, file_name, status_update, task_id, ...rest } =
          args;
        taskTreeManager.setInProgress(task_id, status_update);
        const result = await memoryManager.readSheet(rest);
        if (!ok(result)) return result;
        const parts = llm`${result}`.asParts().at(0);
        if (!parts) {
          return err("Failed to create parts from result");
        }
        const file_path = fileSystem.add(parts, file_name);
        if (!ok(file_path)) return file_path;
        if (output_format === "file") {
          return { file_path };
        }
        return { json: JSON.stringify(result) };
      }
    ),
    defineFunction(
      {
        name: MEMORY_UPDATE_SHEET_FUNCTION,
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
The data to write, may include references to VFS files. For instance, if you have an existing file at "/vfs/text3.md", you can reference it as <file src="/vfs/text3.md" /> in the in data. At update time, the tag will be replaced with the file contents.`
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
        return memoryManager.updateSheet({ range, values });
      }
    ),
    defineFunction(
      {
        name: MEMORY_DELETE_SHEET_FUNCTION,
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
        return memoryManager.deleteSheet(parameters);
      }
    ),
    defineFunction(
      {
        name: MEMORY_GET_METADATA_FUNCTION,
        description: tr`
Returns the names and header rows of all memory sheets.`,
        parameters: {
          ...taskIdSchema,
          ...statusUpdateSchema,
        },
        response: {
          sheets: z.array(
            z.object({
              name: z.string().describe(tr`
The name of the memory sheet
`),
              file_path: z.string().describe(tr`
The VFS file path to read the memory sheet
`),
              columns: z.array(
                z.string().describe(tr`
The column name
`)
              ).describe(tr`
The list of column names
`),
            })
          ),
        },
      },
      async ({ task_id, status_update }) => {
        taskTreeManager.setInProgress(task_id, status_update);
        return memoryManager.getSheetMetadata();
      }
    ),
  ];
}
