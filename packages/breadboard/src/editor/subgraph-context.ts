/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier } from "@breadboard-ai/types";
import { EditOperationContext, Result } from "./types.js";
import { GraphStoreMutator } from "../inspector/types.js";

export { toSubgraphContext };

function toSubgraphContext(
  context: EditOperationContext,
  graphId: GraphIdentifier
): Result<EditOperationContext> {
  if (!graphId) return { success: true, result: context };

  const { graph, inspector } = context;
  const subgraph = graph.graphs?.[graphId];
  const subgraphInspector = inspector.graphs()?.[graphId];
  if (!subgraph || !subgraphInspector)
    return {
      success: false,
      error: "Unable to get subgraph edit context.",
    };

  return {
    success: true,
    result: {
      graph: subgraph,
      inspector: subgraphInspector,
      store: subgraphInspector as unknown as GraphStoreMutator,
      apply: context.apply,
    },
  };
}
