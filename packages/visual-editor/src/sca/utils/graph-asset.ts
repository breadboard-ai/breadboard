/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Asset,
  AssetMetadata,
  AssetPath,
  LLMContent,
} from "@breadboard-ai/types";
import type { GraphAsset } from "../types.js";

export { GraphAssetImpl };

/**
 * Simple data class representing a graph asset.
 *
 * Note: Asset updates are handled by the Asset.updateAsset action,
 * not by methods on this class. This follows the SCA pattern where
 * business logic lives in Actions, not data objects.
 */
class GraphAssetImpl implements GraphAsset {
  public readonly data: LLMContent[];
  public readonly metadata?: AssetMetadata | undefined;

  constructor(
    public readonly path: AssetPath,
    asset: Asset
  ) {
    const { data, metadata } = asset;
    this.data = data as LLMContent[];
    this.metadata = metadata;
  }
}
