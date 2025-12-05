/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { signal } from "signal-utils";
import { Configurator } from "../connectors/configurator";
import { ConnectorType } from "../connectors/types";
import { CreateConnector } from "../transforms/create-connector";
import { ConnectorState, ProjectInternal } from "./types";

export { ConnectorStateImpl };

class ConnectorStateImpl implements ConnectorState {
  @signal
  accessor stage: string = "free";
  #project: ProjectInternal;

  constructor(
    project: ProjectInternal,
    connectorMap: Map<string, ConnectorType>
  ) {
    this.#project = project;
    this.types = connectorMap;
  }

  types: Map<string, ConnectorType>;

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

    const configurator = new Configurator(id, url);

    const initializing = await configurator.initialize();
    if (!ok(initializing)) return this.#free(initializing);

    const updatingGraph = await this.#project.apply(
      new CreateConnector(url, id, initializing)
    );
    return this.#free(updatingGraph);
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
