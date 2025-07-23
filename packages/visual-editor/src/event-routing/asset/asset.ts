/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetMetadata } from "@breadboard-ai/types";
import { EventRoute } from "../types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

export const ChangeEdgeRoute: EventRoute<"asset.changeedge"> = {
  event: "asset.changeedge",

  async do({ runtime, tab, originalEvent, uiState }) {
    uiState.blockingAction = true;
    await runtime.edit.changeAssetEdge(
      tab,
      originalEvent.detail.changeType,
      originalEvent.detail.assetEdge,
      originalEvent.detail.subGraphId
    );

    uiState.blockingAction = false;
    return false;
  },
};

const ASSET_TIMEOUT = 250;
export const AddRoute: EventRoute<"asset.add"> = {
  event: "asset.add",

  async do({ runtime, tab, originalEvent, googleDriveClient }) {
    if (!tab || !googleDriveClient) {
      return false;
    }

    const projectState = runtime.state.getOrCreateProjectState(
      tab.mainGraphId,
      runtime.edit.getEditor(tab)
    );

    if (!projectState) {
      return false;
    }

    let snackbarId;
    const longRunningTaskTimeout = window.setTimeout(() => {
      snackbarId = globalThis.crypto.randomUUID();
      runtime.snackbar(
        snackbarId,
        "Processing assets, please wait...",
        BreadboardUI.Types.SnackType.PENDING,
        [],
        true,
        true
      );
    }, ASSET_TIMEOUT);

    await Promise.all(
      originalEvent.detail.assets.map((asset) => {
        const metadata: AssetMetadata = {
          title: asset.name,
          type: asset.type,
          visual: asset.visual,
          managed: asset.managed,
        };

        if (asset.subType) {
          metadata.subType = asset.subType;
        }

        return projectState?.organizer.addGraphAsset({
          path: asset.path,
          metadata,
          data: [asset.data],
        });
      })
    );

    window.clearTimeout(longRunningTaskTimeout);
    if (snackbarId) {
      runtime.snackbar(
        snackbarId,
        "Processed assets",
        BreadboardUI.Types.SnackType.INFORMATION,
        [],
        false,
        true
      );
    }
    return false;
  },
};
