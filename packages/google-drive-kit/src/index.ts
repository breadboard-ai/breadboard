/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { kit } from "@breadboard-ai/build";
import exportFile from "./components/export-file.js";
import getFileContent from "./components/get-file-content.js";
import listFiles from "./components/list-files.js";
import contextToSlides from "./components/context-to-slides.js";
import getBreadboardFolder from "./components/get-breadboard-folder.js";
import saveContextToDrive from "./components/save-context-to-drive.js";
import loadContextFromDrive from "./components/load-context-from-drive.js";

export default await kit({
  title: "Google Drive Kit",
  url: "npm:@breadboard-ai/google-drive-kit",
  description:
    "Nodes for reading & writing to files in Google Drive, including Docs and Sheets",
  version: "0.0.1",
  components: {
    getFileContent,
    listFiles,
    exportFile,
    contextToSlides,
    getBreadboardFolder,
    saveContextToDrive,
    loadContextFromDrive,
  },
});

export { GoogleDriveBoardServer } from "./board-server/server.js";
