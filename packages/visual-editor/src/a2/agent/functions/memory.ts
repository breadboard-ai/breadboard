/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err } from "@breadboard-ai/utils";
import z from "zod";
import { llm, ok, toText, tr } from "../../a2/utils.js";
import { memorySheetGetter } from "../../google-drive/memory-sheet-getter.js";
import { SheetManager } from "../../google-drive/sheet-manager.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { AgentFileSystem } from "../file-system.js";
import { defineFunction, FunctionDefinition } from "../function-definition.js";
import { PidginTranslator } from "../pidgin-translator.js";

export {
  defineMemoryFunctions,
  MEMORY_CREATE_SHEET_FUNCTION,
  MEMORY_DELETE_SHEET_FUNCTION,
  MEMORY_GET_METADATA_FUNCTION,
  MEMORY_READ_SHEET_FUNCTION,
  MEMORY_UPDATE_SHEET_FUNCTION,
};

const MEMORY_CREATE_SHEET_FUNCTION = "memory_create_sheet";
const MEMORY_READ_SHEET_FUNCTION = "memory_read_sheet";
const MEMORY_UPDATE_SHEET_FUNCTION = "memory_update_sheet";
const MEMORY_DELETE_SHEET_FUNCTION = "memory_delete_sheet";
const MEMORY_GET_METADATA_FUNCTION = "memory_get_metadata";

export type MemoryFunctionArgs = {
  moduleArgs: A2ModuleArgs;
  translator: PidginTranslator;
  fileSystem: AgentFileSystem;
};

function defineMemoryFunctions(args: MemoryFunctionArgs): FunctionDefinition[] {
  const { moduleArgs, translator, fileSystem } = args;
  const memoryManager = new SheetManager(
    moduleArgs,
    memorySheetGetter(moduleArgs)
  );
  return [
    defineFunction(
      {
        name: MEMORY_CREATE_SHEET_FUNCTION,
        description: "Creates a new memory sheet",
        parameters: {
          name: z.string().describe(tr`The name of the sheet`),
          columns: z
            .array(z.string().describe(tr`The name of the column header`))
            .describe(
              tr`
An array of strings representing the column headers (e.g., ['ID', 'Name', 'Status']). First column must always be titled "ID"`
            ),
        },
      },
      memoryManager.createSheet.bind(memoryManager)
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
        const { output_format, file_name, ...rest } = args;
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
The data to write, may include references to VFS files. For instance, if you have an existing file at "/vfs/text3.md", you can reference it as <file src="/vfs/text3.md" /> in the prompt. `
              )
            )
          ).describe(tr`
The 2D array of data to write.
`),
        },
      },
      async (args) => {
        const { range, values: pidginValues } = args;
        const errors: string[] = [];
        const values = pidginValues.map((list) => {
          return list.map((value) => {
            const translated = translator.fromPidginString(value);
            if (!ok(translated)) {
              errors.push(translated.$error);
              return "";
            }
            return toText(translated);
          });
        });
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
        },
      },
      memoryManager.deleteSheet.bind(memoryManager)
    ),
    //     defineFunction(
    //       {
    //         name: "memory_query_sheet",
    //         description: tr`
    // Runs a GViz SQL query to find specific memory data or row indexes.`,
    //         parameters: {
    //           name: z.string().describe(tr`The name of the sheet`),
    //           query: z.string().describe(tr`
    // SQL query like 'SELECT A, B WHERE C = \"Pending\"'`),
    //         },
    //       },
    //       memoryManager.querySheet.bind(memoryManager)
    //     ),
    defineFunction(
      {
        name: MEMORY_GET_METADATA_FUNCTION,
        description: tr`
Returns the names and header rows of all memory sheets.`,
        parameters: {},
        response: {
          sheets: z.array(
            z.object({
              name: z.string().describe(tr`
The name of the memory sheet
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
      memoryManager.getSheetMetadata.bind(memoryManager)
    ),
  ];
}
