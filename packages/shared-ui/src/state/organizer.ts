/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetMetadata, AssetPath, NodeValue } from "@breadboard-ai/types";
import { Outcome } from "@google-labs/breadboard";
import { GraphAsset, Organizer, ProjectInternal } from "./types";

export { ReactiveOrganizer };

class ReactiveOrganizer implements Organizer {
  #project: ProjectInternal;
  readonly graphAssets: Map<AssetPath, GraphAsset>;

  constructor(project: ProjectInternal) {
    this.#project = project;
    this.graphAssets = project.graphAssets;
  }

  addGraphAsset(asset: GraphAsset): Promise<Outcome<void>> {
    const { data, metadata, path } = asset;
    return this.#project.edit(
      [{ type: "addasset", path, data: data as NodeValue, metadata }],
      `Adding asset at path "${path}"`
    );
  }

  removeGraphAsset(path: AssetPath): Promise<Outcome<void>> {
    return this.#project.edit(
      [{ type: "removeasset", path }],
      `Removing asset at path "${path}"`
    );
  }

  changeGraphAssetMetadata(
    path: AssetPath,
    metadata: AssetMetadata
  ): Promise<Outcome<void>> {
    return this.#project.edit(
      [{ type: "changeassetmetadata", path, metadata }],
      `Changing asset metadata at path "${path}"`
    );
  }
}
