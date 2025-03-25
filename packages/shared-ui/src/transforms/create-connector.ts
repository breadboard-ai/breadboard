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

export { CreateConnector };

class CreateConnector implements EditTransform {
  constructor(public readonly url: string) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const id = globalThis.crypto.randomUUID();

    const path = `connectors/${id}`;

    const data: NodeValue = [
      {
        parts: [
          {
            json: {
              url: this.url,
              configuration: {},
            },
          },
        ],
      },
    ] satisfies LLMContent[];

    const metadata: AssetMetadata = {
      title: "Untitled Folio",
      type: "connector",
    };

    return context.apply(
      [{ type: "addasset", path, data, metadata }],
      `Adding asset at path "${path}"`
    );
  }
}
