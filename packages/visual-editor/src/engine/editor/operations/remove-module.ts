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
  ModuleIdentifier,
  SingleEditResult,
} from "@breadboard-ai/types";

export class RemoveModule implements EditOperation {
  async can(
    id: ModuleIdentifier,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    if (!inspector.moduleById(id)) {
      return {
        success: false,
        error: `Module "${id}" does not exist`,
      };
    }
    return {
      success: true,
      affectedNodes: [],
      affectedModules: [id],
      affectedGraphs: [],
    };
  }

  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "removemodule") {
      throw new Error(
        `Editor API integrity error: expected type "removemodule", received "${spec.type}" instead.`
      );
    }
    const { id } = spec;
    const { graph, mutable } = context;
    const inspector = mutable.graphs.get("")!;
    const can = await this.can(id, inspector);
    if (!can.success) {
      return can;
    }

    if (!graph.modules) {
      return {
        success: false,
        error: `Modules do not exist on graph`,
      };
    }

    delete graph.modules[id];

    return {
      success: true,
      affectedNodes: [],
      affectedModules: [id],
      affectedGraphs: [],
    };
  }
}
