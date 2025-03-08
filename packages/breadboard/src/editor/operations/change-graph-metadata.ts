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
import { errorNoInspect } from "./error.js";

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
    const { metadata, graphId } = spec;
    const { mutable } = context;
    const inspector = mutable.graphs.get(graphId);
    if (!inspector) {
      return errorNoInspect(graphId);
    }

    const handle = GraphDescriptorHandle.create(context.graph, graphId);
    if (!handle.success) {
      return handle;
    }
    const graph = handle.result.graph();

    const visualOnly = graph.metadata === metadata;
    graph.metadata = metadata;
    return {
      success: true,
      visualOnly,
      affectedNodes: [],
      affectedModules: [],
      affectedGraphs: [graphId],
    };
  }
}
