/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, NodeDescriberResult, ok, Outcome } from "@google-labs/breadboard";
import { ConnectorInitializerResult, ConnectorView } from "./types";
import {
  GraphTag,
  JsonSerializable,
  LLMContent,
  UUID,
} from "@breadboard-ai/types";
import { SideBoardRuntime } from "../sideboards/types";

export { Configurator };

class Configurator {
  #configuratorUrl?: string;

  constructor(
    public readonly runtime: SideBoardRuntime,
    public readonly id: UUID,
    public readonly url: string
  ) {}

  async #getConfigurator(): Promise<Outcome<string>> {
    if (this.#configuratorUrl) return this.#configuratorUrl;

    const describingConnector = await this.runtime.describe(this.url);
    if (!ok(describingConnector)) return describingConnector;

    const gettingUrl = getExportUrl("connector-configure", describingConnector);
    if (!ok(gettingUrl)) return gettingUrl;

    this.#configuratorUrl = gettingUrl;
    return gettingUrl;
  }

  async #invokeConfigurator(
    payload: JsonSerializable
  ): Promise<Outcome<JsonSerializable>> {
    const configuratorUrl = await this.#getConfigurator();
    if (!ok(configuratorUrl)) return configuratorUrl;
    const invokingInitializer = await this.runtime.runTask({
      graph: configuratorUrl,
      context: toLLMContentArray(payload),
    });
    if (!ok(invokingInitializer)) return invokingInitializer;

    return fromLLMContentArray(invokingInitializer);
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
    configuration: JsonSerializable
  ): Promise<Outcome<LLMContent[]>> {
    const configuratorUrl = await this.#getConfigurator();
    if (!ok(configuratorUrl)) return configuratorUrl;
    const invokingPreview = await this.runtime.runTask({
      graph: configuratorUrl,
      context: toLLMContentArray({
        stage: "preview",
        id: this.id,
        configuration,
      }),
    });
    return invokingPreview;
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

function toLLMContentArray(json: JsonSerializable) {
  return [{ parts: [{ json }] }];
}

function fromLLMContentArray(context: LLMContent[]): Outcome<JsonSerializable> {
  const part = context.at(-1)?.parts.at(0);
  if (part && "json" in part) return part.json;

  return err(`Data not found in output`);
}

function getExportUrl(
  tag: GraphTag,
  result: NodeDescriberResult
): Outcome<string> {
  const exports = result.exports;
  if (!exports) return err(`Invalid connector structure: must have exports`);
  const assetExport = Object.entries(exports).find(([, e]) =>
    e.metadata?.tags?.includes(tag)
  );
  if (!assetExport)
    return err(
      `Invalid connector structure: must have export tagged as "${tag}"`
    );
  return assetExport[0];
}
