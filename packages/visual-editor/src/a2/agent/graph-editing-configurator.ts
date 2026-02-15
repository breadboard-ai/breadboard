/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphEditingActions } from "../runnable-module-factory.js";
import { getGraphEditingFunctionGroup } from "./functions/graph-editing.js";
import type { FunctionGroup } from "./types.js";

export { buildGraphEditingFunctionGroups };

/**
 * Builds the function groups for the graph editing agent.
 *
 * Unlike the content generation agent (which uses `FunctionGroupConfigurator`
 * for its complex deps), this is a plain function that returns groups directly.
 * The graph editing agent has no file system, pidgin, or run state.
 */
function buildGraphEditingFunctionGroups(args: {
  graphEditingActions: GraphEditingActions;
}): FunctionGroup[] {
  return [getGraphEditingFunctionGroup(args)];
}
