/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, ok, Outcome } from "@google-labs/breadboard";
import { ConnectorType } from "../connectors/types";
import { ConnectorState, OrganizerStage, ProjectInternal } from "./types";
import { signal } from "signal-utils";
import { Configurator } from "../connectors/configurator";
import { CreateConnector } from "../transforms/create-connector";

export { ConnectorStateImpl };

class ConnectorStateImpl implements ConnectorState {
  @signal
  accessor stage: OrganizerStage = "free";
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

    const runtime = this.#project.runtime();
    const configurator = new Configurator(runtime, id, url);

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
