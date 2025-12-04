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
import { TransformAllNodes } from "./transform-all-nodes";

export { RemoveAssetWithRefs };

class RemoveAssetWithRefs implements EditTransform {
  constructor(public readonly path: AssetPath) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { path } = this;

    const graphIds = [...Object.keys(context.graph.graphs || {}), ""];

    for (const graphId of graphIds) {
      const marking = await new TransformAllNodes(
        graphId,
        (part) => {
          const { type, path } = part;
          if (type === "asset" && path === this.path) {
            return { ...part, invalid: true };
          }
          return null;
        },
        `Marking references to asset "${this.path}" invalid`
      ).apply(context);
      if (!marking.success) return marking;
    }

    return context.apply(
      [{ type: "removeasset", path }],
      `Removing asset at path "${path}"`
    );
  }
}
