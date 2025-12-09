/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Asset,
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "@breadboard-ai/types";

export { AddAsset };

class AddAsset implements EditOperation {
  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "addasset") {
      throw new Error(
        `Editor API integrity error: expected type "addasset", received "${spec.type}" instead.`
      );
    }

    const { path, metadata, data } = spec;

    const { graph } = context;

    graph.assets ??= {};
    const asset: Asset = { data };
    graph.assets[path] = asset;
    if (metadata) asset.metadata = metadata;

    return {
      success: true,
      affectedGraphs: [],
      affectedModules: [],
      affectedNodes: [],
    };
  }
}
