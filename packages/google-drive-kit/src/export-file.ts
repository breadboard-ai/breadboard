/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input, output } from "@breadboard-ai/build";
import { fetch } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { headers } from "./internal/headers.js";

const fileId = input({
  title: "File ID",
  description: `The ID of the Google Drive file.
See https://developers.google.com/drive/api/reference/rest/v3/files/export#body.PATH_PARAMETERS.file_id`,
});

const mimeType = input({
  title: "MIME Type",
  description: `The MIME type of the format requested for this export.
See https://developers.google.com/drive/api/reference/rest/v3/files/export#body.QUERY_PARAMETERS.mime_type`,
});

const { url } = urlTemplate({
  // https://developers.google.com/drive/api/reference/rest/v3/files/export
  template:
    "https://www.googleapis.com/drive/v3/files/{fileId}/export{?mimeType}",
  fileId,
  mimeType,
}).outputs;

const content = fetch({ url, headers }).outputs.response;

export const exportFile = board({
  title: "Google Drive File",
  description: "A file in Google Drive",
  inputs: { fileId, mimeType },
  outputs: {
    content: output(content, {
      title: "Content",
      description: `The content of the file
See https://developers.google.com/drive/api/reference/rest/v3/files/export#response-body`,
    }),
  },
});
