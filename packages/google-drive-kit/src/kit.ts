/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { serialize } from "@breadboard-ai/build";
import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { exportFile } from "./export-file.js";

export const kit = new Board({
  title: "Google Drive Kit",
  description:
    "Nodes for reading & writing to files in Google Drive, including Docs and Sheets",
  version: "0.0.1",
});
const core = kit.addKit(Core);

kit.graphs = {
  exportFile: serialize(exportFile),
};

core.invoke({
  $id: "exportFile",
  $board: "#exportFile",
  $metadata: {
    title: "Export a file in Google Drive",
    description:
      "Exports a Google Workspace document to the requested MIME type and returns exported byte content. Note that the exported content is limited to 10MB.\n\nSee https://developers.google.com/drive/api/reference/rest/v3/files/export for more details.",
    icon: "google-drive",
  },
});
