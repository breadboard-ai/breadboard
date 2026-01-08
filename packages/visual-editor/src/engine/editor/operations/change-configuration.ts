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
  SingleEditResult,
} from "@breadboard-ai/types";
import { errorNoInspect } from "./error.js";

export class ChangeConfiguration implements EditOperation {
  async can(
    id: NodeIdentifier,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    const node = inspector.nodeById(id);
    if (!node) {
      return {
        success: false,
        error: `Unable to update configuration: node with id "${id}" does not exist`,
      };
    }
    return {
      success: true,
      affectedNodes: [],
      affectedModules: [],
      affectedGraphs: [],
    };
  }

  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "changeconfiguration") {
      throw new Error(
        `Editor API integrity error: expected type "changeconfiguration", received "${spec.type}" instead.`
      );
    }
    const { id, configuration, graphId, reset = false } = spec;
    if (!configuration) {
      return {
        success: false,
        error: "Configuration wasn't supplied.",
      };
    }
    const { mutable } = context;
    const inspector = mutable.graphs.get(graphId);
    if (!inspector) {
      return errorNoInspect(graphId);
    }

    const can = await this.can(id, inspector);
    if (!can.success) {
      return can;
    }
    const node = inspector.nodeById(id);
    if (node) {
      if (reset) {
        node.descriptor.configuration = configuration;
      } else {
        node.descriptor.configuration = {
          ...node.descriptor.configuration,
          ...configuration,
        };
      }
    }
    return {
      success: true,
      affectedNodes: [{ id, graphId }],
      affectedModules: [],
      affectedGraphs: [graphId],
    };
  }
}
