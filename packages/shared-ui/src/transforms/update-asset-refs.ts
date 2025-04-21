/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetPath } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
} from "@google-labs/breadboard";
import { TransformAllNodesAllGraphs } from "./transform-all-nodes-all-graphs";

export { UpdateAssetRefs };

class UpdateAssetRefs implements EditTransform {
  constructor(
    public readonly path: AssetPath,
    public readonly title: string
  ) {}

  apply(context: EditOperationContext): Promise<EditTransformResult> {
    return new TransformAllNodesAllGraphs((part) => {
      const { type, path } = part;
      if (type === "asset" && path === this.path) {
        return { ...part, title: this.title };
      }
      return null;
    }, `Updating title for asset "${this.path}"`).apply(context);
  }
}
