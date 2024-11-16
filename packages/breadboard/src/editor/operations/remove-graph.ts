/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";

export { RemoveGraph };

class RemoveGraph implements EditOperation {
  async do(
    edit: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (edit.type !== "removegraph") {
      throw new Error(
        `Editor API integrity error: expected type "removegraph", received "${edit.type}" instead.`
      );
    }
    const { id } = edit;
    const { graph } = context;

    if (!graph.graphs || !graph.graphs?.[id]) {
      return {
        success: false,
        error: `Failed to remove graph: "${id}" does not exist.`,
      };
    }
    delete graph.graphs[id];
    if (!Object.keys(graph.graphs).length) {
      delete graph.graphs;
    }

    return {
      success: true,
      affectedModules: [],
      affectedNodes: [],
      affectedGraphs: [id],
    };
  }
}
