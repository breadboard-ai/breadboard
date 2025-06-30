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

export class ChangeModule implements EditOperation {
  async can(
    id: ModuleIdentifier,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    const exists = !!inspector.moduleById(id);
    if (!exists) {
      return {
        success: false,
        error: `Unable to update module: module with id "${id}" does not exist`,
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
    if (spec.type !== "changemodule") {
      throw new Error(
        `Editor API integrity error: expected type "changemodule", received "${spec.type}" instead.`
      );
    }
    const id = spec.id;
    const { graph, mutable } = context;
    const inspector = mutable.graphs.get("")!;
    const can = await this.can(id, inspector);
    if (!can.success) {
      return can;
    }

    graph.modules = graph.modules || {};
    graph.modules[spec.id] = spec.module;
    return {
      success: true,
      affectedNodes: [],
      affectedModules: [spec.id],
      affectedGraphs: [],
      visualOnly: false,
    };
  }
}
