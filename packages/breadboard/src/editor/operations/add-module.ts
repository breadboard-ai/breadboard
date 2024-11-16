/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";
import { InspectableGraph } from "../../inspector/types.js";
import { ModuleIdentifier } from "@breadboard-ai/types";

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
    const { graph, inspector } = context;
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
