/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "@breadboard-ai/types";

export { AddGraph };

class AddGraph implements EditOperation {
  async do(
    edit: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (edit.type !== "addgraph") {
      throw new Error(
        `Editor API integrity error: expected type "addgraph", received "${edit.type}" instead.`
      );
    }
    const { id, graph: subgraph } = edit;
    const { graph, mutable } = context;

    if (graph.graphs?.[id]) {
      return {
        success: false,
        error: `Failed to add graph: "${id}" already exists.`,
      };
    }
    graph.graphs ??= {};
    graph.graphs[id] = subgraph;
    mutable.addSubgraph(subgraph, id);

    return {
      success: true,
      affectedModules: [],
      affectedNodes: [],
      affectedGraphs: [id],
    };
  }
}
