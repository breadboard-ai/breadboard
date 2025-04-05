/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetMetadata,
  AssetPath,
  JsonSerializable,
  LLMContent,
  NodeValue,
  ParameterMetadata,
  UUID,
} from "@breadboard-ai/types";
import { err, ok, Outcome } from "@google-labs/breadboard";
import {
  Connector,
  GraphAsset,
  Organizer,
  OrganizerStage,
  ProjectInternal,
} from "./types";
import { RemoveAssetWithRefs } from "../transforms";
import { UpdateAssetWithRefs } from "../transforms/update-asset-with-refs";
import { ChangeParameterMetadata } from "../transforms/change-parameter-metadata";
import { signal } from "signal-utils";
import { Configurator } from "../connectors";
import { ConnectorConfiguration, ConnectorView } from "../connectors/types";
import { CreateConnector } from "../transforms/create-connector";
import { EditConnector } from "../transforms/edit-connector";

export { ReactiveOrganizer };

class ReactiveOrganizer implements Organizer {
  @signal
  accessor stage: OrganizerStage = "free";

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

  async initializeConnectorInstance(
    url: string | null
  ): Promise<Outcome<void>> {
    if (!url) {
      return err(`Connector URL was not specified.`);
    }
    if (this.stage !== "free") {
      return err(
        `Can't create connector: the organizer is already busy doing something else`
      );
    }

    this.stage = "busy";

    const id = globalThis.crypto.randomUUID();

    const runtime = this.#project.runtime();
    const configurator = new Configurator(runtime, id, url);

    const initializing = await configurator.initialize();
    if (!ok(initializing)) return this.#free(initializing);

    const updatingGraph = await this.#project.apply(
      new CreateConnector(url, id, initializing)
    );
    return this.#free(updatingGraph);
  }

  #getConnectorInstance(
    path: AssetPath
  ): Outcome<{ id: UUID; configuration: ConnectorConfiguration }> {
    const id = path.split("/")[1] as UUID;
    if (!id) return err(`Path "${path}" is not a valid connector path`);

    const connector = this.graphAssets.get(path);
    if (!connector) return err(`Connector "${path}" does not exist`);

    if (connector.metadata?.type !== "connector") {
      return err(`The asset "${path}" is not of "connector" type`);
    }

    const part = connector.data.at(-1)?.parts.at(0);
    if (!part || !("json" in part)) {
      return err(`The connector instance "${path}" is misconfigured`);
    }

    return { configuration: part.json as ConnectorConfiguration, id };
  }

  async commitConnectorInstanceEdits(
    path: AssetPath,
    values: Record<string, JsonSerializable>
  ): Promise<Outcome<void>> {
    this.stage = "busy";

    const runtime = this.#project.runtime();

    const config = this.#getConnectorInstance(path);

    if (!ok(config)) return config;

    const { id, configuration } = config;

    const configurator = new Configurator(runtime, id, configuration.url);

    const writing = await configurator.write(values);
    if (!ok(writing)) return this.#free(writing);

    const updatingGraph = await this.#project.apply(
      new EditConnector(path, {
        ...configuration,
        configuration: values,
      })
    );
    if (!ok(updatingGraph)) return this.#free(updatingGraph);

    this.stage = "free";
  }

  async getConnectorView(path: AssetPath): Promise<Outcome<ConnectorView>> {
    const runtime = this.#project.runtime();

    const config = this.#getConnectorInstance(path);
    if (!ok(config)) return config;

    const { configuration, id } = config;

    const configurator = new Configurator(runtime, id, configuration.url);

    this.stage = "busy";
    const reading = await configurator.read(configuration.configuration);
    if (!ok(reading)) return this.#free(reading);

    this.stage = "free";

    return reading;
  }

  #free<T>(outcome: T): T {
    this.stage = "free";
    return outcome;
  }

  async cancel(): Promise<void> {
    this.stage = "free";
    // TODO: Do clean up work.
  }

  connectorInstanceExists(url: string): boolean {
    return this.#project.connectorInstanceExists(url);
  }
}
