/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetPath, GraphIdentifier } from "@breadboard-ai/types";
import {
  Components,
  FastAccess,
  GeneratedAsset,
  GeneratedAssetIdentifier,
  GraphAsset,
  ProjectInternal,
  Tool,
} from "./types";

export { ReactiveFastAccess };

class ReactiveFastAccess implements FastAccess {
  #project: ProjectInternal;

  constructor(
    project: ProjectInternal,
    public readonly graphAssets: Map<AssetPath, GraphAsset>,
    public readonly generatedAssets: Map<
      GeneratedAssetIdentifier,
      GeneratedAsset
    >,
    public readonly tools: Map<string, Tool>,
    public readonly components: Map<GraphIdentifier, Components>
  ) {
    this.#project = project;
  }
}
