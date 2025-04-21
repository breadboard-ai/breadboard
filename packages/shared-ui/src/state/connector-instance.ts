/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UUID } from "crypto";
import {
  ConnectorConfiguration,
  ConnectorInstance,
  ConnectorType,
} from "../connectors/types";
import { AssetPath, JsonSerializable } from "@breadboard-ai/types";
import { GraphAsset, ProjectInternal } from "./types";
import { signal } from "signal-utils";
import { AsyncComputed } from "signal-utils/async-computed";
import { Signal } from "signal-polyfill";
import { err, ok, Outcome } from "@google-labs/breadboard";
import { Configurator } from "../connectors/configurator";
import { EditConnector } from "../transforms/edit-connector";

export { ConnectorInstanceImpl };

class ConnectorInstanceImpl implements ConnectorInstance {
  public readonly id: UUID;

  @signal accessor #asset: GraphAsset;

  readonly #connectorDataChanged = new Signal.State({});

  constructor(
    public readonly type: ConnectorType,
    public readonly path: AssetPath,
    asset: GraphAsset,
    private readonly project: ProjectInternal
  ) {
    this.id = path.split("/")[1] as UUID;
    this.#asset = asset;
  }

  #configuration = new Signal.Computed(() => {
    if (this.#asset.metadata?.type !== "connector") {
      return err(`The asset "${this.id}" is not of "connector" type`);
    }

    const part = this.#asset.data.at(-1)?.parts.at(0);
    if (!part || !("json" in part)) {
      return err(`The connector instance "${this.id}" is misconfigured`);
    }
    return part.json as ConnectorConfiguration;
  });

  get configuration() {
    return this.#configuration.get();
  }

  #view = new AsyncComputed(async (signal) => {
    signal.throwIfAborted();
    this.#connectorDataChanged.get();

    const configuration = this.configuration;
    if (!ok(configuration)) return configuration;

    const configurator = new Configurator(
      this.project.runtime(),
      this.id,
      configuration.url
    );

    return configurator.read(configuration.configuration);
  });

  get view() {
    const view = this.#view.value;
    if (!view) {
      return err(`Connector "${this.id}" view not avaialable`);
    }
    return view;
  }

  #preview = new AsyncComputed(async (signal) => {
    signal.throwIfAborted();
    this.#connectorDataChanged.get();

    const configuration = this.configuration;
    if (!ok(configuration)) return configuration;

    const configurator = new Configurator(
      this.project.runtime(),
      this.id,
      configuration.url
    );

    return configurator.preview(configuration.configuration);
  });

  get preview() {
    const preview = this.#preview.value;
    if (!preview) {
      return err(`Connector "${this.id}" preview not available`);
    }
    return preview;
  }

  async commitEdits(
    title: string | undefined,
    values: Record<string, JsonSerializable>
  ): Promise<Outcome<void>> {
    const configuration = this.configuration;
    if (!ok(configuration)) return configuration;

    const configurator = new Configurator(
      this.project.runtime(),
      this.id,
      configuration.url
    );

    const writing = await configurator.write(values);
    if (!ok(writing)) return writing;

    const updatingGraph = await this.project.apply(
      new EditConnector(this.path, title, {
        ...configuration,
        configuration: writing,
      })
    );
    if (!ok(updatingGraph)) return updatingGraph;
    this.#connectorDataChanged.set({});
  }
}
