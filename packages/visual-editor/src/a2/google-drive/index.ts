/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as googleDriveApi from "./api.js";
import * as googleDriveDocs from "./docs.js";
import * as googleDriveSheets from "./sheets.js";
import * as googleDriveSlides from "./slides.js";
import * as googleDriveSlidesSchema from "./slides-schema.js";
import * as googleDriveTypes from "./types.js";
import * as googleDriveUnescape from "./unescape.js";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl.js";

export const exports = {
  api: googleDriveApi,
  docs: googleDriveDocs,
  sheets: googleDriveSheets,
  "slides-schema": googleDriveSlidesSchema,
  slides: googleDriveSlides,
  types: googleDriveTypes,
  unescape: googleDriveUnescape,
};

export const bgl = createBgl(descriptor, exports);
