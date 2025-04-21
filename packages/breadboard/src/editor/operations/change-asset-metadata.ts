/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetMetadata } from "@breadboard-ai/types";
import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";

export { ChangeAssetMetadata };

class ChangeAssetMetadata implements EditOperation {
  #isVisualOnly(
    incoming: AssetMetadata,
    existing: AssetMetadata | undefined
  ): boolean {
    if (!existing) {
      return false;
    }
    return (
      existing.title === incoming.title &&
      existing.description === incoming.description &&
      existing.type === incoming.type &&
      existing.subType == incoming.subType
    );
  }

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

    const visualOnly = this.#isVisualOnly(metadata, asset.metadata);

    asset.metadata = metadata;

    return {
      visualOnly,
      success: true,
      affectedGraphs: [],
      affectedModules: [],
      affectedNodes: [],
    };
  }
}
