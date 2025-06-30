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

export { RemoveAsset };

class RemoveAsset implements EditOperation {
  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "removeasset") {
      throw new Error(
        `Editor API integrity error: expected type "removeasset", received "${spec.type}" instead.`
      );
    }

    const { path } = spec;

    const {
      graph: { assets },
    } = context;

    if (assets) {
      delete assets[path];
      if (Object.keys(assets).length === 0) {
        delete context.graph.assets;
      }
    }

    return {
      success: true,
      affectedGraphs: [],
      affectedModules: [],
      affectedNodes: [],
    };
  }
}
