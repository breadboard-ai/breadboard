/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { assembleFunctionGroup } from "../function-definition.js";
import { FunctionGroup } from "../types.js";
import { AgentFileSystem } from "../file-system.js";
import { ok } from "@breadboard-ai/utils/outcome.js";
import { asBlob } from "../../../data/common.js";
import { create, upload } from "../../google-drive/api.js";
import { getMimeTypeMapping } from "../../google-drive/get-mime-type-mapping.js";
import { GOOGLE_DRIVE_FOLDER_MIME_TYPE } from "@breadboard-ai/utils/google-drive/operations.js";

import {
  declarations,
  metadata,
  instruction,
  type GoogleDriveUploadFileParams,
  type GoogleDriveCreateFolderParams,
} from "./generated/google-drive.js";

export { getGoogleDriveFunctionGroup };

export type GoogleDriveFunctionsGroupArgs = {
  moduleArgs: A2ModuleArgs;
  fileSystem: AgentFileSystem;
};

function getGoogleDriveFunctionGroup(
  args: GoogleDriveFunctionsGroupArgs
): FunctionGroup {
  const { fileSystem, moduleArgs } = args;

  return assembleFunctionGroup(declarations, metadata, instruction, {
    google_drive_upload_file: async (
      {
        file_path,
        name,
        convert,
        parent,
        status_update,
      }: GoogleDriveUploadFileParams,
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
    },

    google_drive_create_folder: async (
      { name, parent, status_update }: GoogleDriveCreateFolderParams,
      statusUpdater
    ) => {
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
    },
  });
}
