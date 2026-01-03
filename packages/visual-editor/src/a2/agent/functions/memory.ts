/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { tr } from "../../a2/utils.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { defineFunction, FunctionDefinition } from "../function-definition.js";
import { SheetManager } from "../../google-drive/sheet-manager.js";
import { memorySheetGetter } from "../../google-drive/memory-sheet-getter.js";

export {
  defineMemoryFunctions,
  MEMORY_CREATE_SHEET_FUNCTION,
  MEMORY_READ_SHEET_FUNCTION,
  MEMORY_UPDATE_SHEET_FUNCTION,
  MEMORY_DELETE_SHEET_FUNCTION,
  MEMORY_GET_METADATA_FUNCTION,
};

const MEMORY_CREATE_SHEET_FUNCTION = "memory_create_sheet";
const MEMORY_READ_SHEET_FUNCTION = "memory_read_sheet";
const MEMORY_UPDATE_SHEET_FUNCTION = "memory_update_sheet";
const MEMORY_DELETE_SHEET_FUNCTION = "memory_delete_sheet";
const MEMORY_GET_METADATA_FUNCTION = "memory_get_metadata";

export type MemoryFunctionArgs = {
  moduleArgs: A2ModuleArgs;
};

function defineMemoryFunctions(args: MemoryFunctionArgs): FunctionDefinition[] {
  const memoryManager = new SheetManager(
    args.moduleArgs,
    memorySheetGetter(args.moduleArgs)
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
        },
      },
      memoryManager.readSheet.bind(memoryManager)
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
          values: z.array(z.array(z.string())).describe(tr`
The 2D array of data to write.
`),
        },
      },
      memoryManager.updateSheet.bind(memoryManager)
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
