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
import { create, upload } from "../../google-drive/api.js";
import { getMimeTypeMapping } from "../../google-drive/get-mime-type-mapping.js";
import { GOOGLE_DRIVE_FOLDER_MIME_TYPE } from "@breadboard-ai/utils/google-drive/operations.js";
import { statusUpdateSchema } from "./system.js";

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
Uploads a file to Google Drive. Supports automatic conversion of office formats (like PPTX, DOCX, XLSX) into Google Workspace formats.

`,
        parameters: {
          name: z.string().describe(tr`
The user-friendly name of the file that will show up in Drive list
`),
          file_path: z.string().describe(tr`

The file path to the file to upload.

`),
          convert: z
            .boolean()
            .describe(
              tr`

If true, converts Office documents or CSVs into Google Docs/Slides/Sheets.

`
            )
            .default(true),
          parent: z
            .string()
            .describe(
              tr`
            
The Google Drive folder that will be the parent of this newly uploaded file`
            )
            .optional(),
          ...statusUpdateSchema,
        },
        response: {
          file_path: z
            .string()
            .describe(
              tr`
The file path that points at the generated Google Doc.
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
      async (
        { file_path, name, convert, parent, status_update },
        statusUpdater
      ) => {
        statusUpdater(status_update || `Uploading "${name}" to Google Drive`);
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
        const parents = parent ? [parent] : undefined;
        const uploading = await upload(
          moduleArgs,
          { name, mimeType: targetMime, parents },
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
    defineFunction(
      {
        name: "google_drive_create_folder",
        description: tr`
Creates a new Google Drive folder.
`,
        parameters: {
          name: z.string().describe(tr`
The user-friendly name of the file that will show up in Drive list
`),
          parent: z
            .string()
            .describe(
              tr`
            
The Google Drive folder that will be the parent of this newly created folder`
            )
            .optional(),
          ...statusUpdateSchema,
        },
        response: {
          folder_id: z
            .string()
            .describe(
              tr`
The Google Drive Folder ID of the newly created folder`
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
      async ({ name, parent, status_update }, statusUpdater) => {
        statusUpdater(
          status_update || `Creating "${name}" folder in Google Drive`
        );
        const parents = parent ? [parent] : undefined;
        const creating = await create(moduleArgs, {
          name,
          mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
          parents,
        });
        if (!ok(creating)) {
          return { error: creating.$error };
        }
        return { folder_id: creating.id };
      }
    ),
  ];
}
