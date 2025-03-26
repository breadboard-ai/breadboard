/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetMetadata, LLMContent, NodeValue } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
} from "@google-labs/breadboard";
import { ConnectorInitializerResult } from "../connectors/types";

export { CreateConnector };

class CreateConnector implements EditTransform {
  constructor(
    public readonly url: string,
    public readonly id: string,
    public readonly initialValues: ConnectorInitializerResult
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const path = `connectors/${this.id}`;

    const data: NodeValue = [
      {
        parts: [
          {
            json: {
              url: this.url,
              configuration: this.initialValues.configuration,
            },
          },
        ],
      },
    ] satisfies LLMContent[];

    const metadata: AssetMetadata = {
      title: this.initialValues.title,
      type: "connector",
    };

    return context.apply(
      [{ type: "addasset", path, data, metadata }],
      `Adding asset at path "${path}"`
    );
  }
}
