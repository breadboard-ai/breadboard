/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphEditingActions } from "../runnable-module-factory.js";
import type { FunctionGroupConfigurator } from "./loop.js";
import { getGraphEditingFunctionGroup } from "./functions/graph-editing.js";

export { createGraphEditingConfigurator };

/**
 * Creates a FunctionGroupConfigurator for the graph editing agent.
 * This is a separate agent from the content generation agent —
 * following the same pattern as `createSimulatedUserConfigurator`.
 */
function createGraphEditingConfigurator(
  graphEditingActions: GraphEditingActions
): FunctionGroupConfigurator {
  return async () => {
    return [getGraphEditingFunctionGroup({ graphEditingActions })];
  };
}
