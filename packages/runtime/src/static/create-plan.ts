/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { ExecutionPlan } from "./types.js";

export { createPlan };

/**
 * Creates an execution plan from the provided GraphDescription.
 * The graph is guaranteed to be condensed (no cycles), and each
 * strongly connected components is represented with a single node
 * that has a "folded" tag.
 */
function createPlan(graph: GraphDescriptor): ExecutionPlan {
  throw new Error("not yet implemented");
}
