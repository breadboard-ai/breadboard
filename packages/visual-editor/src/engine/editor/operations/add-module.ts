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

export class AddModule implements EditOperation {
  async can(
    id: ModuleIdentifier,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    const exists = inspector.moduleById(id);
    if (exists) {
      return {
        success: false,
        error: `Unable to add module: module with id "${id}" already exists`,
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
    if (spec.type !== "addmodule") {
      throw new Error(
        `Editor API integrity error: expected type "addmodule", received "${spec.type}" instead.`
      );
    }
    const { id, module } = spec;
    const { graph, mutable } = context;
    const inspector = mutable.graphs.get("")!;
    const can = await this.can(id, inspector);
    if (!can.success) {
      return can;
    }

    graph.modules ??= {};
    graph.modules[id] = module;

    return {
      success: true,
      affectedNodes: [],
      affectedModules: [id],
      affectedGraphs: [],
    };
  }
}
