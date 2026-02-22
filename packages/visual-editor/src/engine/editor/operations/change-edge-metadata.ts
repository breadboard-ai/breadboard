/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "@breadboard-ai/types";
import { GraphDescriptorHandle } from "../graph-descriptor-handle.js";
import { findEdgeIndex } from "../edge.js";
import { error } from "./error.js";

export { ChangeEdgeMetadata };

class ChangeEdgeMetadata implements EditOperation {
  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "changeedgemetadata") {
      return error(
        `Invalid edit operation: expected "changeedgemetadata", got "${spec.type}".`
      );
    }
    const { graphId, metadata, edge } = spec;
    const { graph: mainGraph } = context;

    const handle = GraphDescriptorHandle.create(mainGraph, graphId);
    if (!handle.success) {
      return handle;
    }

    const graph = handle.result.graph();
    const index = findEdgeIndex(graph, edge);
    if (index < 0) {
      return error(
        `Unable to find edge between "${edge.from}" and "${edge.to}`
      );
    }
    const existingEdge = graph.edges[index]!;
    const existingMetadata = existingEdge.metadata || {};
    existingEdge.metadata = {
      ...existingMetadata,
      ...metadata,
    };
    return {
      success: true,
      affectedGraphs: [graphId],
      affectedNodes: [],
    };
  }
}
