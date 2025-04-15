/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetPath, JsonSerializable, UUID } from "@breadboard-ai/types";
import { err, ok, Outcome } from "@google-labs/breadboard";
import { ConnectorConfiguration, ConnectorView } from "../connectors/types";
import {
  Connector,
  ConnectorState,
  OrganizerStage,
  ProjectInternal,
} from "./types";
import { signal } from "signal-utils";
import { Configurator } from "../connectors/configurator";
import { CreateConnector } from "../transforms/create-connector";
import { EditConnector } from "../transforms/edit-connector";

export { ConnectorStateImpl };

class ConnectorStateImpl implements ConnectorState {
  @signal
  accessor stage: OrganizerStage = "free";
  #project: ProjectInternal;

  constructor(project: ProjectInternal, connectorMap: Map<string, Connector>) {
    this.#project = project;
    this.types = connectorMap;
  }

  types: Map<string, Connector>;

  #getConnectorInstance(
    path: AssetPath
  ): Outcome<{ id: UUID; configuration: ConnectorConfiguration }> {
    const id = path.split("/")[1] as UUID;
    if (!id) return err(`Path "${path}" is not a valid connector path`);

    const connector = this.#project.graphAssets.get(path);
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

  async initializeInstance(url: string | null): Promise<Outcome<void>> {
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

  async commitInstanceEdits(
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
        configuration: writing,
      })
    );
    if (!ok(updatingGraph)) return this.#free(updatingGraph);

    this.stage = "free";
  }

  async getInstanceView(path: AssetPath): Promise<Outcome<ConnectorView>> {
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

  instanceExists(url: string): boolean {
    return this.#project.connectorInstanceExists(url);
  }
}
