/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlerContext } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils/outcome.js";
import type { SheetGetter, SheetManagerConfig } from "./sheet-manager.js";
import { SHEETS_MIME_TYPE } from "./sheets.js";
import { create, setSpreadsheetValues, updateSpreadsheet } from "./api.js";

export { memorySheetGetter };

function memorySheetGetter(config: SheetManagerConfig): SheetGetter {
  return async (context: NodeHandlerContext, readonly: boolean) => {
    const { url, title } = context.currentGraph || {};
    const graphId = url?.replace("drive:/", "") || "";
    const name = `Memory for ${title ?? graphId}`;
    const mimeType = SHEETS_MIME_TYPE;
    const findFile = await config.shell.getDriveCollectorFile(
      mimeType,
      graphId,
      graphId
    );
    if (!findFile.ok) return err(findFile.error);
    const fileId = findFile.id;
    if (fileId) return fileId;
    if (readonly) return null;

    const deps = { ...config, context };
    const fileKey = `sheet${graphId}${graphId}`;
    const createdFile = await create(deps, {
      name,
      mimeType,
      appProperties: {
        "google-drive-connector": fileKey,
      },
    });
    if (!ok(createdFile)) return createdFile;
    const { id } = createdFile;

    const renameSheet = await updateSpreadsheet(deps, id, [
      {
        updateSheetProperties: {
          properties: { sheetId: 0, title: "intro" },
          fields: "title",
        },
      },
    ]);
    if (!ok(renameSheet)) return renameSheet;

    const addIntro = await setSpreadsheetValues(deps, id, "intro!A1", [
      [
        "This spreadsheet is used as agent memory. Do not modify it directly. To reset the memory for the agent, move this entire spreadsheet into trash.",
      ],
    ]);

    if (!ok(addIntro)) return addIntro;

    return id;
  };
}
