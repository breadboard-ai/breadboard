/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetMetadata } from "@breadboard-ai/types";
import { EventRoute } from "../types.js";
import * as BreadboardUI from "../../ui/index.js";

export const ChangeEdgeRoute: EventRoute<"asset.changeedge"> = {
  event: "asset.changeedge",

  async do({ originalEvent, sca }) {
    sca.controller.global.main.blockingAction = true;
    try {
      await sca.actions.graph.changeAssetEdge(
        originalEvent.detail.changeType,
        originalEvent.detail.assetEdge,
        originalEvent.detail.subGraphId
      );
    } finally {
      sca.controller.global.main.blockingAction = false;
    }
    return false;
  },
};

const ASSET_TIMEOUT = 250;
export const AddRoute: EventRoute<"asset.add"> = {
  event: "asset.add",

  async do({ runtime, sca, tab, originalEvent, googleDriveClient }) {
    if (!tab || !googleDriveClient) {
      return false;
    }

    const projectState = runtime.state.project;

    if (!projectState) {
      return false;
    }

    let snackbarId;
    const longRunningTaskTimeout = window.setTimeout(() => {
      snackbarId = globalThis.crypto.randomUUID();
      sca.controller.global.snackbars.snackbar(
        "Processing assets, please wait...",
        BreadboardUI.Types.SnackType.PENDING,
        [],
        true,
        snackbarId,
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
      sca.controller.global.snackbars.snackbar(
        "Processed assets",
        BreadboardUI.Types.SnackType.INFORMATION,
        [],
        false,
        snackbarId,
        true
      );
    }
    return false;
  },
};
