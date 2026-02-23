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
  AssetMetadata,
  AssetPath,
  LLMContent,
  NodeValue,
  Outcome,
} from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import type { StateEvent } from "../../../ui/events/events.js";
import { SnackType, type SnackbarUUID } from "../../types.js";
import { ChangeAssetEdge } from "../../../ui/transforms/index.js";

import { makeAction, withUIBlocking } from "../binder.js";
import { asAction, ActionMode, stateEventTrigger } from "../../coordination.js";
import { onGraphVersionChange } from "./triggers.js";
import { UpdateAssetWithRefs } from "../../../ui/transforms/update-asset-with-refs.js";
import { UpdateAssetData } from "../../../ui/transforms/update-asset-data.js";
import { RemoveAssetWithRefs } from "../../../ui/transforms/remove-asset-with-refs.js";
import { isInlineData } from "../../../data/common.js";
import { GraphAssetImpl } from "../../utils/graph-asset.js";
import type { GraphAsset, GraphAssetDescriptor } from "../../types.js";

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

// Imported from the shared utility for local use and re-exported for
// backwards compatibility. New callers should import from
// "../../utils/persist-data-parts.js" directly.
import { persistDataParts } from "../../utils/persist-data-parts.js";
export { persistDataParts };

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

// =============================================================================
// Event-Triggered Actions
// =============================================================================

const ASSET_TIMEOUT = 250;

/**
 * Adds, removes, or changes an asset edge.
 *
 * **Triggers:** `asset.changeedge` StateEvent
 */
export const onChangeAssetEdge = asAction(
  "Asset.onChangeAssetEdge",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Asset Change Edge",
        services.stateEventBus,
        "asset.changeedge"
      );
    },
  },
  async (evt?: StateEvent<"asset.changeedge">): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = evt!.detail;
    await withUIBlocking(controller, async () => {
      const graphId = detail.subGraphId ?? "";
      const transform = new ChangeAssetEdge(
        detail.changeType,
        graphId,
        detail.assetEdge
      );
      const result = await editor.apply(transform);
      if (!result.success) {
        throw new Error(result.error);
      }
    });
  }
);

/**
 * Adds one or more assets to the graph.
 *
 * **Triggers:** `asset.add` StateEvent
 */
export const onAddAssets = asAction(
  "Asset.onAddAssets",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Asset Add",
        services.stateEventBus,
        "asset.add"
      );
    },
  },
  async (evt?: StateEvent<"asset.add">): Promise<void> => {
    const { controller, services } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    const detail = evt!.detail;

    let snackbarId: SnackbarUUID | undefined;
    const longRunningTaskTimeout = window.setTimeout(() => {
      snackbarId = globalThis.crypto.randomUUID() as SnackbarUUID;
      controller.global.snackbars.snackbar(
        "Processing assets, please wait...",
        SnackType.PENDING,
        [],
        true,
        snackbarId,
        true
      );
    }, ASSET_TIMEOUT);

    const graphUrl = controller.editor.graph.url;

    await Promise.all(
      detail.assets.map(async (asset) => {
        const metadata: AssetMetadata = {
          title: asset.name,
          type: asset.type,
          visual: asset.visual,
          managed: asset.managed,
        };

        if (asset.subType) {
          metadata.subType = asset.subType;
        }

        // Mark inline data with asset title
        for (const part of asset.data.parts) {
          if (isInlineData(part)) {
            part.inlineData.title = metadata.title;
          }
        }

        // Persist data parts
        const data = await persistDataParts(
          graphUrl,
          [asset.data],
          services.googleDriveBoardServer.dataPartTransformer()
        );

        await editor.edit(
          [
            {
              type: "addasset",
              path: asset.path,
              data: data as NodeValue,
              metadata,
            },
          ],
          `Adding asset at path "${asset.path}"`
        );
      })
    );

    window.clearTimeout(longRunningTaskTimeout);
    if (snackbarId) {
      controller.global.snackbars.snackbar(
        "Processed assets",
        SnackType.INFORMATION,
        [],
        false,
        snackbarId,
        true
      );
    }
  }
);
