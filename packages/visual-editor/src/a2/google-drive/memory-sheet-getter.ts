/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, ok } from "@breadboard-ai/utils/outcome.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import type { SheetGetter } from "./sheet-manager.js";
import { SHEETS_MIME_TYPE } from "./sheets.js";
import { create } from "./api.js";

export { memorySheetGetter };

function memorySheetGetter(moduleArgs: A2ModuleArgs): SheetGetter {
  return async () => {
    const { url, title } = moduleArgs.context.currentGraph || {};
    const graphId = url?.replace("drive:/", "") || "";
    const name = `Memory for ${title ?? graphId}`;
    const mimeType = SHEETS_MIME_TYPE;
    const findFile = await moduleArgs.shell.getDriveCollectorFile(
      mimeType,
      graphId,
      graphId
    );
    if (!findFile.ok) return err(findFile.error);
    const fileId = findFile.id;
    if (fileId) return fileId;

    const fileKey = `sheet${graphId}${graphId}`;
    const createdFile = await create(moduleArgs, {
      name,
      mimeType,
      appProperties: {
        "google-drive-connector": fileKey,
      },
    });
    if (!ok(createdFile)) return createdFile;

    return createdFile.id;
  };
}
