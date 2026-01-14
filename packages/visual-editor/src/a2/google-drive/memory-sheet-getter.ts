/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, ok } from "@breadboard-ai/utils/outcome.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import type { SheetGetter } from "./sheet-manager.js";
import { SHEETS_MIME_TYPE } from "./sheets.js";
import { create, setSpreadsheetValues, updateSpreadsheet } from "./api.js";

export { memorySheetGetter };

function memorySheetGetter(moduleArgs: A2ModuleArgs): SheetGetter {
  return async (readonly: boolean) => {
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
    if (readonly) return null;

    const fileKey = `sheet${graphId}${graphId}`;
    const createdFile = await create(moduleArgs, {
      name,
      mimeType,
      appProperties: {
        "google-drive-connector": fileKey,
      },
    });
    if (!ok(createdFile)) return createdFile;
    const { id } = createdFile;

    const renameSheet = await updateSpreadsheet(moduleArgs, id, [
      {
        updateSheetProperties: {
          properties: { sheetId: 0, title: "intro" },
          fields: "title",
        },
      },
    ]);
    if (!ok(renameSheet)) return renameSheet;

    const addIntro = await setSpreadsheetValues(moduleArgs, id, "intro!A1", [
      [
        "This spreadsheet is used as agent memory. Do not modify it directly. To reset the memory for the agent, move this entire spreadsheet into trash.",
      ],
    ]);

    if (!ok(addIntro)) return addIntro;

    return id;
  };
}
