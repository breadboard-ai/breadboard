/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for Graph Asset management.
 *
 * Assets are files/documents attached to a graph. This module provides:
 * - `syncFromGraph`: Syncs assets from graph descriptor to controller (triggered)
 * - `update`: Updates an asset's title and data (called directly)
 */

import type {
  AssetPath,
  LLMContent,
  NodeValue,
  Outcome,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { getLogger, Formatter } from "../../utils/logging/logger.js";

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onGraphVersionChange } from "./triggers.js";
import { UpdateAssetWithRefs } from "../../../ui/transforms/update-asset-with-refs.js";
import { UpdateAssetData } from "../../../ui/transforms/update-asset-data.js";
import { RemoveAssetWithRefs } from "../../../ui/transforms/remove-asset-with-refs.js";
import { isInlineData, transformDataParts } from "../../../data/common.js";
import { GraphAssetImpl } from "../../../ui/state/graph-asset.js";
import type {
  GraphAsset,
  GraphAssetDescriptor,
} from "../../../ui/state/types.js";

export const bind = makeAction();

/**
 * Syncs graph assets from the graph descriptor to the controller.
 *
 * This action reads the assets from the current graph and updates
 * `graphController.graphAssets` with simple GraphAsset data objects.
 *
 * **Triggers:**
 * - `onGraphVersionChange`: Fires when the graph version changes
 */
export const syncFromGraph = asAction(
  "Asset.syncFromGraph",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onGraphVersionChange(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const graphController = controller.editor.graph;
    const graph = graphController.graph;

    if (!graph) {
      // No graph loaded, clear assets
      graphController.setGraphAssets(new Map());
      return;
    }

    const { assets = {} } = graph;

    // Create simple GraphAsset data objects
    const graphAssets = new Map<AssetPath, GraphAsset>(
      Object.entries(assets).map(([path, asset]) => [
        path,
        new GraphAssetImpl(path, asset),
      ])
    );

    graphController.setGraphAssets(graphAssets);
  }
);

/**
 * Updates an asset's title and optionally its data.
 *
 * This replaces the logic previously in `GraphAssetImpl.update()`.
 * It applies transforms via the editor and persists data parts.
 */
export const update = asAction(
  "Asset.update",
  { mode: ActionMode.Immediate },
  async (
    path: AssetPath,
    title: string,
    data?: LLMContent[]
  ): Promise<Outcome<void>> => {
    const { controller, services } = bind;
    const graphController = controller.editor.graph;
    const editor = graphController.editor;

    if (!editor) {
      return err("No editor available to apply asset update");
    }

    // Get current asset to check metadata
    const asset = graphController.graphAssets.get(path);
    if (!asset?.metadata) {
      return err(`Graph asset "${path}" has no metadata, can't update`);
    }

    const metadata = { ...asset.metadata, title };

    // Persist data BEFORE applying any transforms.
    // This prevents a flicker where UpdateAssetWithRefs bumps the graph
    // version (triggering syncFromGraph with old data) while persist is
    // still in-flight.
    let persistedData: LLMContent[] | undefined;
    if (data) {
      persistedData = await persistDataParts(
        graphController.url,
        data,
        services.googleDriveBoardServer.dataPartTransformer()
      );
    }

    // When data is provided, apply UpdateAssetData FIRST so that the
    // graph descriptor has the new data before any syncFromGraph fires.
    // This avoids a flicker where the old drawing data briefly appears.
    if (persistedData) {
      let result = await editor.apply(
        new UpdateAssetData(path, metadata, persistedData)
      );
      if (!result.success) {
        return err(result.error);
      }

      // Now update refs (node configs referencing the asset title).
      // syncFromGraph will fire again but data is already correct.
      result = await editor.apply(new UpdateAssetWithRefs(path, metadata));
      if (!result.success) {
        return err(result.error);
      }
    } else {
      // Title-only update, no data change
      const result = await editor.apply(
        new UpdateAssetWithRefs(path, metadata)
      );
      if (!result.success) {
        return err(result.error);
      }
    }

    return;
  }
);

/**
 * Persists data parts to storage.
 */
export async function persistDataParts(
  urlString: string | null,
  contents: LLMContent[],
  transformer: ReturnType<
    typeof bind.services.googleDriveBoardServer.dataPartTransformer
  >
): Promise<LLMContent[]> {
  if (!urlString) {
    getLogger().log(
      Formatter.warning("Can't persist blob without graph URL"),
      "Asset.persistDataParts"
    );
    return contents;
  }

  const url = new URL(urlString);

  const transformed = await transformDataParts(
    url,
    contents,
    "persistent",
    transformer
  );
  if (!ok(transformed)) {
    getLogger().log(
      Formatter.warning(`Failed to persist a blob: "${transformed.$error}"`),
      "Asset.persistDataParts"
    );
    return contents;
  }

  return transformed;
}

/**
 * Adds a new graph asset. Persists data parts first, then edits the graph.
 */
export const addGraphAsset = asAction(
  "Asset.addGraphAsset",
  { mode: ActionMode.Immediate },
  async (asset: GraphAssetDescriptor): Promise<Outcome<void>> => {
    const { controller, services } = bind;
    const graphController = controller.editor.graph;
    const editor = graphController.editor;

    if (!editor) {
      return err("No editor available");
    }

    const { data: assetData, metadata, path } = asset;
    for (const data of assetData) {
      for (const part of data.parts) {
        if (isInlineData(part)) {
          part.inlineData.title = metadata?.title;
        }
      }
    }

    const data = (await persistDataParts(
      graphController.url,
      assetData,
      services.googleDriveBoardServer.dataPartTransformer()
    )) as NodeValue;

    const result = await editor.edit(
      [{ type: "addasset", path, data, metadata }],
      `Adding asset at path "${path}"`
    );
    if (!result.success) {
      return err(result.error);
    }
  }
);

/**
 * Removes a graph asset and cleans up references.
 */
export const removeGraphAsset = asAction(
  "Asset.removeGraphAsset",
  { mode: ActionMode.Immediate },
  async (path: AssetPath): Promise<Outcome<void>> => {
    const { controller } = bind;
    const editor = controller.editor.graph.editor;

    if (!editor) {
      return err("No editor available");
    }

    const result = await editor.apply(new RemoveAssetWithRefs(path));
    if (!result.success) {
      return err(result.error);
    }
  }
);
