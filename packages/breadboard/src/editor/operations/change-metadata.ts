/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditOperation,
  EditOperationContext,
  EditSpec,
  InspectableGraph,
  NodeIdentifier,
  NodeMetadata,
  SingleEditResult,
} from "@breadboard-ai/types";
import { errorNoInspect } from "./error.js";

export class ChangeMetadata implements EditOperation {
  async can(
    id: NodeIdentifier,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    const node = inspector.nodeById(id);
    if (!node) {
      return {
        success: false,
        error: `Unable to change metadata: node with id "${id}" does not exist`,
      };
    }
    return {
      success: true,
      affectedNodes: [],
      affectedModules: [],
      affectedGraphs: [],
    };
  }

  #isVisualOnly(incoming: NodeMetadata, existing: NodeMetadata): boolean {
    return (
      existing.title === incoming.title &&
      existing.description === incoming.description &&
      existing.logLevel === incoming.logLevel
    );
  }

  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "changemetadata") {
      throw new Error(
        `Editor API integrity error: expected type "changemetadata", received "${spec.type}" instead.`
      );
    }
    const { id, metadata, graphId, reset = false } = spec;
    const { mutable } = context;
    const inspector = mutable.graphs.get(graphId);
    if (!inspector) {
      return errorNoInspect(graphId);
    }

    const can = await this.can(id, inspector);
    if (!can.success) return can;
    const node = inspector.nodeById(id);
    if (!node) {
      const error = `Unknown node with id "${id}"`;
      return { success: false, error };
    }
    const visualOnly = this.#isVisualOnly(
      metadata,
      node.descriptor.metadata || {}
    );
    const oldMetadata = node.descriptor.metadata;
    if (reset) {
      node.descriptor.metadata = metadata;
    } else {
      node.descriptor.metadata = {
        ...oldMetadata,
        ...metadata,
      };
    }
    const affectedNodes = visualOnly ? [] : [{ id, graphId }];
    return {
      success: true,
      visualOnly,
      affectedNodes,
      affectedModules: [],
      affectedGraphs: [graphId],
    };
  }
}
