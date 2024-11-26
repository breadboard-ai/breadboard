/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  InputValues,
} from "@breadboard-ai/types";
import { DescriberManager } from "../inspector/graph/describer-manager.js";
import { MutableGraphImpl } from "../inspector/graph/mutable-graph.js";
import { NodeDescriberResult } from "../types.js";
import { Result } from "../editor/types.js";
import { InspectableGraphOptions } from "../inspector/types.js";

export { describe };

/**
 * A helper describer function for kits.
 * @deprecated Convert to use GraphStore instead.
 */
async function describe(
  graph: GraphDescriptor,
  graphId: GraphIdentifier,
  options: InspectableGraphOptions = {},
  inputs?: InputValues
): Promise<Result<NodeDescriberResult>> {
  const mutable = new MutableGraphImpl(graph, options);
  const describer = DescriberManager.create(graphId, mutable);
  if (!describer.success) {
    return describer;
  }
  return {
    success: true,
    result: await describer.result.describe(inputs),
  };
}
