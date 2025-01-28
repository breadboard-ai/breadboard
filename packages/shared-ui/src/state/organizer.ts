/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Asset, AssetMetadata, AssetPath } from "@breadboard-ai/types";
import { Outcome } from "@google-labs/breadboard";
import { Organizer, ProjectInternal } from "./types";

export { ReactiveOrganizer };

class ReactiveOrganizer implements Organizer {
  #project: ProjectInternal;
  readonly assets: Map<AssetPath, Asset>;

  constructor(project: ProjectInternal) {
    this.#project = project;
    this.assets = project.assets;
  }

  addAsset(path: AssetPath, asset: Asset): Promise<Outcome<void>> {
    const { data, metadata } = asset;
    return this.#project.edit(
      [{ type: "addasset", path, data, metadata }],
      `Adding asset at path "${path}"`
    );
  }

  removeAsset(path: AssetPath): Promise<Outcome<void>> {
    return this.#project.edit(
      [{ type: "removeasset", path }],
      `Removing asset at path "${path}"`
    );
  }

  changeAssetMetadata(
    path: AssetPath,
    metadata: AssetMetadata
  ): Promise<Outcome<void>> {
    return this.#project.edit(
      [{ type: "changeassetmetadata", path, metadata }],
      `Changing asset metadata at path "${path}"`
    );
  }
}
