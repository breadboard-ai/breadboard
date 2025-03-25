/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier } from "@breadboard-ai/types";
import { NodeDescriberResult } from "../types.js";

export { isModule, getModuleId, emptyDescriberResult, filterEmptyValues };

const MODULE_EXPORT_PREFIX = "#module:";

function isModule(graphId: GraphIdentifier) {
  return graphId.startsWith(MODULE_EXPORT_PREFIX);
}

function getModuleId(graphId: GraphIdentifier) {
  return graphId.slice(MODULE_EXPORT_PREFIX.length);
}

function emptyDescriberResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}

/**
 * A utility function to filter out empty (null or undefined) values from
 * an object.
 *
 * @param obj -- The object to filter.
 * @returns -- The object with empty values removed.
 */
function filterEmptyValues<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (!value) return false;
      if (typeof value === "object") {
        return Object.keys(value).length > 0;
      }
      return true;
    })
  ) as T;
}
