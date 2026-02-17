/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditOperation,
  EditOperationContext,
  EditSpec,
  GraphIdentifier,
  SingleEditResult,
} from "@breadboard-ai/types";

export class ToggleExport implements EditOperation {
  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "toggleexport") {
      throw new Error(
        `Editor API integrity error: expected type "toggleexport", received "${spec.type}" instead.`
      );
    }
    const { id } = spec;
    const { mutable } = context;

    const affectedGraphs: GraphIdentifier[] = [];

    // toggle graph export.
    const graphId = id as GraphIdentifier;
    if (graphId !== "" && !mutable.graph.graphs?.[graphId]) {
      return {
        success: false,
        error: `Unable to toggle export: graph "${graphId}" does not exist.`,
      };
    }
    const exportId = `#${id}`;
    affectedGraphs.push(id);

    const exports = new Set(mutable.graph.exports || []);
    if (exports.has(exportId)) {
      exports.delete(exportId);
    } else {
      exports.add(exportId);
    }
    mutable.graph.exports = [...exports];
    return {
      success: true,
      affectedNodes: [],
      affectedGraphs,
    };
  }
}
