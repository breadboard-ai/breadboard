/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as folioConfigurator from "./configurator";
import * as folioLoadAll from "./load-all";
import * as folioSaveState from "./save-state";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  configurator: folioConfigurator,
  "load-all": folioLoadAll,
  "save-state": folioSaveState,
};

export const bgl = createBgl(descriptor, exports);
