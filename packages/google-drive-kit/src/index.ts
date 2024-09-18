/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { kit } from "@breadboard-ai/build";
import exportFile from "./components/export-file.js";
import getFileContent from "./components/get-file-content.js";
import listFiles from "./components/list-files.js";

export default await kit({
  title: "Google Drive Kit",
  url: "npm:@breadboard-ai/google-drive-kit",
  description:
    "Nodes for reading & writing to files in Google Drive, including Docs and Sheets",
  version: "0.0.1",
  components: { getFileContent, listFiles, exportFile },
});
