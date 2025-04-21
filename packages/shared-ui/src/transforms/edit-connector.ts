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
import { UpdateAssetWithRefs } from "./update-asset-with-refs";
import { UpdateAssetRefs } from "./update-asset-refs";

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
        error: `The connector asset "${path}" could not be edited, because it doesn't exist`,
      };
    }

    let { metadata } = asset;
    const { data: existingData } = asset;

    if (!metadata) {
      return {
        success: false,
        error: `The connector asset "${path}" could not be edited, because it has not yet been initialized.`,
      };
    }

    let changeTitle = false;

    if (title !== undefined && metadata?.title !== title) {
      metadata = { ...metadata, title };
      changeTitle = true;
    }

    if (this.#sameConfig(existingData)) {
      if (changeTitle) {
        const updatingAsset = await new UpdateAssetWithRefs(
          path,
          metadata!
        ).apply(context);
        if (!updatingAsset.success) return updatingAsset;
      }
      return { success: true };
    }

    const json = this.configuration;
    const data: NodeValue = [{ parts: [{ json }] }] satisfies LLMContent[];

    const editing = await context.apply(
      [
        { type: "removeasset", path },
        { type: "addasset", path, data, metadata },
      ],
      `Editing asset at path "${path}"`
    );
    if (!editing.success) return editing;

    if (!changeTitle) return { success: true };

    return new UpdateAssetRefs(path, title!).apply(context);
  }
}
