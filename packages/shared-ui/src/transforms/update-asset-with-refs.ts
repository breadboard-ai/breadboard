/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetMetadata, AssetPath } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
} from "@google-labs/breadboard";
import { TransformAllNodes } from "./transform-all-nodes";

export { UpdateAssetWithRefs };

class UpdateAssetWithRefs implements EditTransform {
  constructor(
    public readonly path: AssetPath,
    public readonly metadata: AssetMetadata
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { path, metadata } = this;

    const graphIds = [...Object.keys(context.graph.graphs || {}), ""];

    for (const graphId of graphIds) {
      const updatingRef = await new TransformAllNodes(
        graphId,
        (part) => {
          const { type, path } = part;
          if (type === "asset" && path === this.path) {
            return { ...part, title: metadata.title };
          }
          return null;
        },
        `Updating title for asset "${this.path}"`
      ).apply(context);
      if (!updatingRef.success) return updatingRef;
    }

    return context.apply(
      [{ type: "changeassetmetadata", path, metadata }],
      `Changing asset metadata at path "${path}"`
    );
  }
}
