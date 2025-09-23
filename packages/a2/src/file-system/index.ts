/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fileSystemConfigurator from "./configurator";
import * as fileSystemConnectorLoad from "./connector-load";
import * as fileSystemConnectorSave from "./connector-save";
import * as fileSystemTypes from "./types";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  configurator: fileSystemConfigurator,
  "connector-load": fileSystemConnectorLoad,
  "connector-save": fileSystemConnectorSave,
  types: fileSystemTypes,
};

export const bgl = createBgl(descriptor, exports);
