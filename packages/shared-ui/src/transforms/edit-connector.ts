/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, NodeValue } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  hash,
  ok,
} from "@google-labs/breadboard";
import { ConnectorConfiguration } from "../connectors/types";
import { configFromData } from "../connectors/util";

export { EditConnector };

class EditConnector implements EditTransform {
  constructor(
    public readonly path: string,
    public readonly title: string | undefined,
    public readonly configuration: ConnectorConfiguration
  ) {}

  #sameConfig(data: NodeValue) {
    const config = configFromData(data);
    if (!ok(config)) return true;

    const { url, configuration } = config;

    if (this.configuration.url !== url) return false;

    return hash(this.configuration.configuration) === hash(configuration);
  }

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { path, title } = this;

    // Get current metadata
    const { graph } = context;
    const asset = graph.assets?.[path];
    if (!asset) {
      return {
        success: false,
        error: `The asset "${path}" could not be edited, because it doesn't exist`,
      };
    }

    let { metadata } = asset;
    const { data: existingData } = asset;

    if (
      title !== undefined &&
      metadata !== undefined &&
      metadata?.title !== title
    ) {
      metadata = { ...metadata, title };
    } else if (this.#sameConfig(existingData)) {
      return { success: true };
    }

    const data: NodeValue = [
      {
        parts: [
          {
            json: this.configuration,
          },
        ],
      },
    ] satisfies LLMContent[];

    return context.apply(
      [
        { type: "removeasset", path },
        { type: "addasset", path, data, metadata },
      ],
      `Editing asset at path "${path}"`
    );
  }
}
