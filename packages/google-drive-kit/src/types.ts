/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { array, enumeration, object, optional } from "@breadboard-ai/build";

/**
 * A Breadboard Type Expression corresponding to
 * https://developers.google.com/drive/api/reference/rest/v3/files#File
 */
export const fileType = object({
  kind: enumeration("drive#file"),
  mimeType: "string",
  id: "string",
  name: "string",
  resourceKey: optional("string"),
});

export const fileListType = object({
  kind: enumeration("drive#fileList"),
  nextPageToken: optional("string"),
  incompleteSearch: "boolean",
  files: array(fileType),
});
