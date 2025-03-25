/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetMetadata,
  AssetPath,
  LLMContent,
  NodeValue,
  ParameterMetadata,
} from "@breadboard-ai/types";
import { err, Outcome } from "@google-labs/breadboard";
import { Connector, GraphAsset, Organizer, ProjectInternal } from "./types";
import { RemoveAssetWithRefs } from "../transforms";
import { UpdateAssetWithRefs } from "../transforms/update-asset-with-refs";
import { ChangeParameterMetadata } from "../transforms/change-parameter-metadata";
import { CreateConnector } from "../transforms/create-connector";

export { ReactiveOrganizer };

class ReactiveOrganizer implements Organizer {
  #project: ProjectInternal;
  readonly graphAssets: Map<AssetPath, GraphAsset>;
  readonly graphUrl: URL | null;
  readonly parameters: Map<string, ParameterMetadata>;
  readonly connectors: Map<string, Connector>;

  constructor(project: ProjectInternal) {
    this.#project = project;
    this.graphAssets = project.graphAssets;
    this.graphUrl = project.graphUrl;
    this.parameters = project.parameters;
    this.connectors = project.connectors;
  }

  async addGraphAsset(asset: GraphAsset): Promise<Outcome<void>> {
    const { data: assetData, metadata, path } = asset;
    const data = (await this.#project.persistBlobs(assetData)) as NodeValue;
    return this.#project.edit(
      [{ type: "addasset", path, data, metadata }],
      `Adding asset at path "${path}"`
    );
  }

  removeGraphAsset(path: AssetPath): Promise<Outcome<void>> {
    return this.#project.apply(new RemoveAssetWithRefs(path));
  }

  changeGraphAssetMetadata(
    path: AssetPath,
    metadata: AssetMetadata
  ): Promise<Outcome<void>> {
    return this.#project.apply(new UpdateAssetWithRefs(path, metadata));
  }

  async changeParameterMetadata(
    id: string,
    metadata: ParameterMetadata
  ): Promise<Outcome<void>> {
    // TODO: Make work for subgraphs.
    const { sample: ephemeralSample } = metadata;
    const sample = (await this.#project.persistBlobs(
      ephemeralSample as LLMContent[]
    )) as NodeValue;
    const persistedMetadata: ParameterMetadata = { ...metadata, sample };
    return this.#project.apply(
      new ChangeParameterMetadata(id, persistedMetadata, "")
    );
  }

  async createConnector(url: string | null): Promise<Outcome<void>> {
    if (!url) {
      return err(`Connector URL was not specified.`);
    }
    return this.#project.apply(new CreateConnector(url));
  }
}
