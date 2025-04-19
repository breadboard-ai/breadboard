/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  GraphIdentifier,
  ParameterMetadata,
} from "@breadboard-ai/types";
import {
  Components,
  FastAccess,
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
    public readonly tools: Map<string, Tool>,
    public readonly myTools: Map<string, Tool>,
    public readonly components: Map<GraphIdentifier, Components>,
    public readonly parameters: Map<string, ParameterMetadata>
  ) {
    this.#project = project;
  }
}
