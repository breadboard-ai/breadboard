/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetMetadata,
  AssetPath,
  LLMContent,
  NodeValue,
} from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
} from "@google-labs/breadboard";

export { UpdateAssetData };

class UpdateAssetData implements EditTransform {
  constructor(
    public readonly path: AssetPath,
    public readonly metadata: AssetMetadata,
    public readonly data: LLMContent[]
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { path, metadata, data } = this;

    return context.apply(
      [{ type: "addasset", path, metadata, data: data as NodeValue }],
      `Changing asset data at path "${path}"`
    );
  }
}
