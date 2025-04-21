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
import { UpdateAssetRefs } from "./update-asset-refs";

export { UpdateAssetWithRefs };

class UpdateAssetWithRefs implements EditTransform {
  constructor(
    public readonly path: AssetPath,
    public readonly metadata: AssetMetadata
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { path, metadata } = this;

    const updatingRef = await new UpdateAssetRefs(path, metadata.title).apply(
      context
    );
    if (!updatingRef.success) return updatingRef;

    return context.apply(
      [{ type: "changeassetmetadata", path, metadata }],
      `Changing asset metadata at path "${path}"`
    );
  }
}
