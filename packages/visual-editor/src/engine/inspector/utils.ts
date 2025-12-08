/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier } from "@breadboard-ai/types";

export { isModule, getModuleId };

const MODULE_EXPORT_PREFIX = "#module:";

function isModule(graphId: GraphIdentifier) {
  return graphId.startsWith(MODULE_EXPORT_PREFIX);
}

function getModuleId(graphId: GraphIdentifier) {
  return graphId.slice(MODULE_EXPORT_PREFIX.length);
}
