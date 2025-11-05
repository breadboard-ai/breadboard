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
  FilteredIntegrations,
  GraphAsset,
  Tool,
} from "./types";
import { FilteredMap } from "./utils/filtered-map";

export { ReactiveFastAccess };

class ReactiveFastAccess implements FastAccess {
  readonly controlFlow: FilteredMap<Tool>;

  constructor(
    public readonly graphAssets: Map<AssetPath, GraphAsset>,
    public readonly tools: Map<string, Tool>,
    public readonly myTools: Map<string, Tool>,
    unfilteredControlFlow: Map<string, Tool>,
    public readonly components: Map<GraphIdentifier, Components>,
    public readonly parameters: Map<string, ParameterMetadata>,
    public readonly integrations: FilteredIntegrations
  ) {
    this.controlFlow = new FilteredMap(unfilteredControlFlow);
  }
}
