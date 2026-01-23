/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { tr } from "../../a2/utils.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { defineFunction, mapDefinitions } from "../function-definition.js";
import { FunctionGroup } from "../types.js";

export { getExportFunctionGroup };

export type ExportFunctionGroupArgs = {
  moduleArgs: A2ModuleArgs;
};

const instruction = tr``;

function getExportFunctionGroup(args: ExportFunctionGroupArgs): FunctionGroup {
  return { ...mapDefinitions(defineExportFunctions(args)), instruction };
}

function defineExportFunctions(args: ExportFunctionGroupArgs) {
  console.log("args", args);
  return [
    defineFunction(
      {
        name: "generate_google_doc",
        description:
          "Generates and creates a Google Drive Document (Google Doc) based on a prompt",
        parameters: {
          prompt: z.string().describe(tr`

A detailed prompt for what document to generate. This function is effectively a sub-agent that 1) calls Gemini to first generate code to create a DOCX file, 2) runs this code, 3) imports the resulting DOCX as a Google Doc.

The prompt may include references to VFS files as <file> tags. This is particularly useful when the document needs to contain images.

To generated beautiful docs:
- Be sure to provide all necessary content
- Be specific about the layout of the text and images within the constraints of what's possible in DOCX format.

`),
        },
        response: {
          file_path: z
            .string()
            .describe(
              tr`
The VFS path that points at the generated Google Doc.
`
            )
            .optional(),
          error: z
            .string()
            .describe(
              tr`

If an error has occurred, will contain a description of the error
`
            )
            .optional(),
        },
      },
      async ({ prompt }) => {
        console.log("PROMPT", prompt);
        return {
          error: "Failed to generate document: Functionality not implemented",
        };
      }
    ),
  ];
}
