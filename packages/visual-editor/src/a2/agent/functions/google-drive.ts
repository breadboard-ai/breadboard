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
import { AgentFileSystem } from "../file-system.js";
import { ok } from "@breadboard-ai/utils/outcome.js";
import { asBlob } from "../../../data/common.js";
import { upload } from "../../google-drive/api.js";
import { getMimeTypeMapping } from "../../google-drive/get-mime-type-mapping.js";

export { getGoogleDriveFunctionGroup };

export type GoogleDriveFunctionsGroupArgs = {
  moduleArgs: A2ModuleArgs;
  fileSystem: AgentFileSystem;
};

function getGoogleDriveFunctionGroup(
  args: GoogleDriveFunctionsGroupArgs
): FunctionGroup {
  return { ...mapDefinitions(defineGoogleDriveFunctions(args)) };
}

function defineGoogleDriveFunctions(args: GoogleDriveFunctionsGroupArgs) {
  const { fileSystem, moduleArgs } = args;
  return [
    defineFunction(
      {
        name: "google_drive_upload_file",
        description: tr`
Uploads a VFS file to Google Drive. Supports automatic conversion of office formats (like PPTX, DOCX, XLSX) into Google Workspace formats.

`,
        parameters: {
          name: z.string().describe(tr`
The user-friendly name of the file that will show up in Drive list
`),
          file_path: z.string().describe(tr`

The VFS path to the file to upload.

`),
          convert: z
            .boolean()
            .describe(
              tr`

If true, converts Office documents or CSVs into Google Docs/Slides/Sheets.

`
            )
            .default(true),
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
      async ({ file_path, name, convert }) => {
        console.log("file_path", file_path);
        console.log("convert", convert);

        const files = await fileSystem.get(file_path);
        if (!ok(files)) {
          return { error: files.$error };
        }
        const part = files.at(0)!;
        const { sourceMime, targetMime } = getMimeTypeMapping(
          file_path,
          convert
        );
        let blob: Blob;
        if ("text" in part) {
          blob = new Blob([part.text], { type: sourceMime });
        } else if ("inlineData" in part || "storedData" in part) {
          try {
            blob = await asBlob(part);
          } catch (e) {
            return { error: (e as Error).message };
          }
        } else {
          return {
            error: `Unable to retrieve file "${file_path}": this functionality is not yet implemented`,
          };
        }
        const uploading = await upload(
          moduleArgs,
          { name, mimeType: targetMime },
          blob
        );
        if (!ok(uploading)) {
          return { error: uploading.$error };
        }
        const handle = fileSystem.add({
          storedData: {
            mimeType: targetMime,
            handle: `drive:/${uploading.id}`,
          },
        });
        if (!ok(handle)) return handle;
        return { file_path: handle };
      }
    ),
  ];
}
