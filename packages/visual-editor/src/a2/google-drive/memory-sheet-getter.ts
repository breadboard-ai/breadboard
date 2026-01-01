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
  return async (id: string) => {
    const { url, title } = moduleArgs.context.board || {};
    const graphId = url ?? "";
    const name = `Memory for ${title ?? id}`;
    const findFile = await moduleArgs.shell.getDriveCollectorFile(
      SHEETS_MIME_TYPE,
      id,
      graphId
    );
    if (!findFile.ok) return err(findFile.error);
    const fileId = findFile.id;
    if (fileId) return fileId;

    const fileKey = `sheet${id}${graphId}`;
    const createdFile = await create(moduleArgs, {
      name,
      SHEETS_MIME_TYPE,
      appProperties: {
        "google-drive-connector": fileKey,
      },
    });
    if (!ok(createdFile)) return createdFile;

    return createdFile.id;
  };
}
