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
} from "@google-labs/breadboard";
import { ConnectorConfiguration } from "../connectors/types";

export { EditConnector };

class EditConnector implements EditTransform {
  constructor(
    public readonly id: string,
    public readonly configuration: ConnectorConfiguration
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const path = `connectors/${this.id}`;

    const data: NodeValue = [
      {
        parts: [
          {
            json: this.configuration,
          },
        ],
      },
    ] satisfies LLMContent[];

    // Get current metadata
    const { graph } = context;
    const asset = graph.assets?.[this.id];
    if (!asset) {
      return {
        success: false,
        error: `The asset with id "${this.id}" could not be edited, because it doesn't exist`,
      };
    }

    const { metadata } = asset;

    return context.apply(
      [
        { type: "removeasset", path },
        { type: "addasset", path, data, metadata },
      ],
      `Editing asset at path "${path}"`
    );
  }
}
