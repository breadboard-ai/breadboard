/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as googleDriveApi from "./api";
import * as googleDriveConfigurator from "./configurator";
import * as googleDriveConnectorLoad from "./connector-load";
import * as googleDriveConnectorSave from "./connector-save";
import * as googleDriveDocs from "./docs";
import * as googleDriveSheets from "./sheets";
import * as googleDriveSlides from "./slides";
import * as googleDriveSlidesSchema from "./slides-schema";
import * as googleDriveTypes from "./types";
import * as googleDriveUnescape from "./unescape";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  api: googleDriveApi,
  configurator: googleDriveConfigurator,
  "connector-load": googleDriveConnectorLoad,
  "connector-save": googleDriveConnectorSave,
  docs: googleDriveDocs,
  sheets: googleDriveSheets,
  "slides-schema": googleDriveSlidesSchema,
  slides: googleDriveSlides,
  types: googleDriveTypes,
  unescape: googleDriveUnescape,
};

export const bgl = createBgl(descriptor, exports);
