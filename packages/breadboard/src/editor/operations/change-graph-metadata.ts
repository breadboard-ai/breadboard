/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptorHandle } from "../../inspector/graph/graph-descriptor-handle.js";
import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";

export class ChangeGraphMetadata implements EditOperation {
  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "changegraphmetadata") {
      throw new Error(
        `Editor API integrity error: expected type "changegraphmetadata", received "${spec.type}" instead.`
      );
    }
    const { metadata, graphId, title, description } = spec;

    const handle = GraphDescriptorHandle.create(context.graph, graphId);
    if (!handle.success) {
      return handle;
    }
    const graph = handle.result.graph();

    const visualOnly = graph.metadata === metadata && !(title || description);
    if (metadata) {
      graph.metadata = metadata;
    }
    if (title) {
      graph.title = title;
    }
    if (description) {
      graph.description = description;
    }
    return {
      success: true,
      visualOnly,
      affectedNodes: [],
      affectedModules: [],
      affectedGraphs: [graphId],
    };
  }
}
