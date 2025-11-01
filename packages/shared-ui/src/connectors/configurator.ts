/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, ok, Outcome } from "@google-labs/breadboard";
import { ConnectorInitializerResult, ConnectorView } from "./types";
import { JsonSerializable, LLMContent, UUID } from "@breadboard-ai/types";

export { Configurator };

class Configurator {
  constructor(
    public readonly id: UUID,
    public readonly url: string
  ) {}

  async #invokeConfigurator(
    _payload: JsonSerializable
  ): Promise<Outcome<JsonSerializable>> {
    return err(
      `Connectors are deprecated and unused. If you see this error, please file Feedback`
    );
  }

  /**
   * Does the work of calling the connector configurator at the
   * "initialize" stage.
   * @returns
   */
  async initialize(): Promise<Outcome<ConnectorInitializerResult>> {
    const result = await this.#invokeConfigurator({
      stage: "initialize",
      id: this.id,
    });
    if (!ok(result)) return result;

    return result as ConnectorInitializerResult;
  }

  async read(configuration: JsonSerializable): Promise<Outcome<ConnectorView>> {
    const result = await this.#invokeConfigurator({
      stage: "read",
      id: this.id,
      configuration,
    });
    if (!ok(result)) return result;

    return result as ConnectorView;
  }

  async preview(
    _configuration: JsonSerializable
  ): Promise<Outcome<LLMContent[]>> {
    return err(
      `Connectors are deprecated and unused. If you see this error, please file Feedback`
    );
  }

  async write(
    values: Record<string, JsonSerializable>
  ): Promise<Outcome<JsonSerializable>> {
    const result = await this.#invokeConfigurator({
      stage: "write",
      id: this.id,
      values,
    });
    if (!ok(result)) return result;

    // When there's an empty response, assume that there's no write stage
    // defined for this connector.
    if (
      typeof result === "object" &&
      result !== null &&
      !Array.isArray(result) &&
      Object.keys(result).length === 0
    ) {
      return values;
    }
    return result;
  }
}
