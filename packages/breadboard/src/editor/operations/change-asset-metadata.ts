/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";

export { ChangeAssetMetadata };

class ChangeAssetMetadata implements EditOperation {
  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "changeassetmetadata") {
      throw new Error(
        `Editor API integrity error: expected type "changeassetmetadata", received "${spec.type}" instead.`
      );
    }

    const { path, metadata } = spec;

    const { graph } = context;

    const asset = graph.assets?.[path];

    if (!asset) {
      return {
        success: false,
        error: `Unable to edit non-existing asset "${path}"`,
      };
    }

    asset.metadata = metadata;

    return {
      success: true,
      affectedGraphs: [],
      affectedModules: [],
      affectedNodes: [],
    };
  }
}
