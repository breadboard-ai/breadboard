/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import {
  Components,
  FastAccess,
  GeneratedAsset,
  GeneratedAssetIdentifier,
  GraphAsset,
  ProjectInternal,
  Tool,
} from "./types";
import { err, Outcome } from "@google-labs/breadboard";

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

  selectGraphAsset(path: AssetPath): Outcome<string> {
    if (!this.graphAssets.has(path)) {
      return err(`Path "${path}" was not found in assets.`);
    }

    return `{{ asset | path: "${path}" }}`;
  }

  selectTool(url: string): Outcome<string> {
    if (!this.tools.has(url)) {
      return err(`Tool "${url}" is not a known tool.`);
    }
    return `{{ tool | url: "${url}" }}`;
  }

  selectComponent(_graphId: GraphIdentifier, _id: NodeIdentifier): void {
    // TODO: Implement.
  }
}
