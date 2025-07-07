/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";

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
