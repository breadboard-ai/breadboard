/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Asset, AssetPath, AssetType, LLMContent } from "@breadboard-ai/types";
import { InspectableAsset } from "../types.js";

export { InspectableAssetImpl };

class InspectableAssetImpl implements InspectableAsset {
  readonly title: string;
  readonly description: string;
  readonly type: AssetType;
  readonly subType: string;
  readonly data: LLMContent[];
  readonly visual: Record<string, unknown>;

  constructor(path: AssetPath, asset: Asset) {
    this.title = asset.metadata?.title || path;
    this.description = asset.metadata?.description || "";
    this.type = asset.metadata?.type || "content";
    this.subType = asset.metadata?.subType || "";
    this.data = asset.data as LLMContent[];
    this.visual = (asset?.metadata?.visual as Record<string, unknown>) || {};
  }
}
