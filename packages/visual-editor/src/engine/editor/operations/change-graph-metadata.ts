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
import { GraphDescriptorHandle } from "../graph-descriptor-handle.js";

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
      affectedGraphs: [graphId],
    };
  }
}
