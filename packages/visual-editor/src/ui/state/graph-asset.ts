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
import { GraphAsset, ProjectInternal } from "./types.js";
import { err } from "@breadboard-ai/utils";
import { Outcome } from "@breadboard-ai/types";
import { UpdateAssetWithRefs } from "../transforms/update-asset-with-refs.js";
import { UpdateAssetData } from "../transforms/update-asset-data.js";

export { GraphAssetImpl };

class GraphAssetImpl implements GraphAsset {
  public readonly data: LLMContent[];
  public readonly metadata?: AssetMetadata | undefined;

  constructor(
    private readonly project: ProjectInternal,
    public readonly path: AssetPath,
    asset: Asset
  ) {
    const { data, metadata } = asset;
    this.data = data as LLMContent[];
    this.metadata = metadata;
  }

  async update(title: string, data: LLMContent[]): Promise<Outcome<void>> {
    if (!this.metadata) {
      return err(
        `Graph asset "${this.path}" has no metadata, can't update the title`
      );
    }
    const metadata = { ...this.metadata, title };

    // Start by applying the update to the refs.
    let update = this.project.apply(
      new UpdateAssetWithRefs(this.path, metadata)
    );

    // If the data has changed, await the first update
    if (data) {
      await update;

      // Now persist blobs and update the asset data.
      const persistedData = await this.project.persistDataParts(data);
      update = this.project.apply(
        new UpdateAssetData(this.path, metadata, persistedData)
      );
    }

    return update;
  }
}
