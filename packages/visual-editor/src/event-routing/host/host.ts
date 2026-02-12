/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseUrl } from "../../ui/utils/urls.js";
import { EventRoute } from "../types.js";
import type { AssetEdgeIdentifier, EdgeIdentifier } from "../../sca/types.js";

export const ModeRoute: EventRoute<"host.modetoggle"> = {
  event: "host.modetoggle",

  async do({ sca, originalEvent }) {
    const current = parseUrl(window.location.href);
    if (current.page === "graph") {
      const newMode = originalEvent.detail.mode;
      if (newMode !== current.mode) {
        sca.controller.router.go({ ...current, mode: newMode });
      }
    }
    return false;
  },
};

export const SelectionStateChangeRoute: EventRoute<"host.selectionstatechange"> =
  {
    event: "host.selectionstatechange",

    async do({ runtime, sca, originalEvent, tab }) {
      const sel = sca.controller.editor.selection;
      const { selections, replaceExistingSelections } = originalEvent.detail;

      if (replaceExistingSelections) {
        sel.deselectAll();
      }

      if (selections) {
        for (const [, graphState] of selections.graphs) {
          for (const nodeId of graphState.nodes) {
            sel.addNode(nodeId);
          }
          for (const edgeId of graphState.edges) {
            sel.addEdge(edgeId as EdgeIdentifier);
          }
          for (const assetId of graphState.assets) {
            sel.addAsset(assetId);
          }
          for (const assetEdgeId of graphState.assetEdges) {
            sel.addAssetEdge(assetEdgeId as AssetEdgeIdentifier);
          }
        }
      }

      // Legacy bridge: keep runtime.select flowing until canvas-controller
      // and entity-editor are migrated to consume SelectionController.
      if (tab) {
        runtime.select.processSelections(
          tab.id,
          originalEvent.detail.selectionChangeId,
          originalEvent.detail.selections,
          originalEvent.detail.replaceExistingSelections,
          originalEvent.detail.moveToSelection
        );
      }
      return false;
    },
  };

export const LockRoute: EventRoute<"host.lock"> = {
  event: "host.lock",

  async do({ sca }) {
    sca.controller.global.main.blockingAction = true;
    return false;
  },
};

export const UnlockRoute: EventRoute<"host.unlock"> = {
  event: "host.unlock",

  async do({ sca }) {
    sca.controller.global.main.blockingAction = false;
    return false;
  },
};

export const FlagChangeRoute: EventRoute<"host.flagchange"> = {
  event: "host.flagchange",

  async do({ sca, originalEvent }) {
    if (typeof originalEvent.detail.value !== "undefined") {
      await sca.controller.global.flags.override(
        originalEvent.detail.flag,
        originalEvent.detail.value
      );
    } else {
      await sca.controller.global.flags.clearOverride(
        originalEvent.detail.flag
      );
    }
    return false;
  },
};

export const UserSignInRoute: EventRoute<"host.usersignin"> = {
  event: "host.usersignin",

  async do() {
    // Noop for main routing. This event is only handled in Lite mode.
    return false;
  },
};
