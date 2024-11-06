/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotate, board, input, object, output } from "@breadboard-ai/build";
import { code, fetch } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { headers } from "../internal/headers.js";

const fileId = input({
  title: "File ID",
  description: `The ID of the file.
See https://developers.google.com/drive/api/reference/rest/v3/files/get#body.PATH_PARAMETERS.file_id`,
  type: annotate(
    object({
      id: "string",
      preview: "string",
    }),
    { behavior: ["google-drive-file-id", "config"] }
  ),
});

const getIdValue = code({ fileId }, { id: "string" }, ({ fileId }) => {
  return { id: fileId.id };
});

const url = urlTemplate({
  // https://developers.google.com/drive/api/reference/rest/v3/files/get
  template: "https://www.googleapis.com/drive/v3/files/{fileId}?alt=media",
  fileId: getIdValue.outputs.id,
});

const response = fetch({ url, headers });

export const getFileContent = board({
  id: "getFileContent",
  title: "Get File Content",
  description: "Get the content of a file in Google Drive",
  version: "0.1.0",
  metadata: {
    icon: "google-drive",
  },
  inputs: { fileId },
  outputs: {
    content: output(response, {
      title: "Content",
      description: `The content of the file`,
    }),
  },
});

export default getFileContent;
