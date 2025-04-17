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
import { AssetPath } from "@breadboard-ai/types";
import { GraphAsset } from "./types";
import { signal } from "signal-utils";
import { AsyncComputed } from "signal-utils/async-computed";
import { Signal } from "signal-polyfill";
import { err, ok } from "@google-labs/breadboard";
import { SideBoardRuntime } from "../sideboards/types";
import { Configurator } from "../connectors/configurator";

export { ConnectorInstanceImpl };

class ConnectorInstanceImpl implements ConnectorInstance {
  public readonly id: UUID;

  @signal accessor #asset: GraphAsset;

  constructor(
    public readonly type: ConnectorType,
    path: AssetPath,
    asset: GraphAsset,
    private readonly runtime: SideBoardRuntime
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

    const configuration = this.configuration;
    if (!ok(configuration)) return configuration;

    const configurator = new Configurator(
      this.runtime,
      this.id,
      configuration.url
    );

    const reading = await configurator.read(configuration.configuration);
    if (!ok(reading)) return reading;
    return reading;
  });

  get view() {
    if (this.#view.error) {
      return err(JSON.stringify(this.#view.error));
    }
    return this.#view.value!;
  }
}
