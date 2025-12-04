/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetPath } from "@breadboard-ai/types";
import { GraphAsset, RendererState } from "./types";

export { RendererStateImpl };

class RendererStateImpl implements RendererState {
  constructor(public readonly graphAssets: Map<AssetPath, GraphAsset>) {}
}
