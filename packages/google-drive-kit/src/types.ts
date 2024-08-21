/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { enumeration, object, optional } from "@breadboard-ai/build";

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
