/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseUrl } from "@breadboard-ai/shared-ui/utils/urls.js";
import { EventRoute } from "../types";

export const ModeRoute: EventRoute<"host.modetoggle"> = {
  event: "host.modetoggle",

  async do({ runtime, originalEvent }) {
    const current = parseUrl(window.location.href);
    if (current.page === "graph") {
      const newMode = originalEvent.detail.mode;
      if (newMode !== current.mode) {
        runtime.router.go({ ...current, mode: newMode });
      }
    }
    return false;
  },
};

export const SelectionStateChangeRoute: EventRoute<"host.selectionstatechange"> =
  {
    event: "host.selectionstatechange",

    async do({ runtime, originalEvent, tab }) {
      if (!tab) {
        return false;
      }

      runtime.select.processSelections(
        tab.id,
        originalEvent.detail.selectionChangeId,
        originalEvent.detail.selections,
        originalEvent.detail.replaceExistingSelections,
        originalEvent.detail.moveToSelection
      );
      return false;
    },
  };

export const LockRoute: EventRoute<"host.lock"> = {
  event: "host.lock",

  async do({ uiState }) {
    uiState.blockingAction = true;
    return false;
  },
};

export const UnlockRoute: EventRoute<"host.unlock"> = {
  event: "host.unlock",

  async do({ uiState }) {
    uiState.blockingAction = false;
    return false;
  },
};

export const FlagChangeRoute: EventRoute<"host.flagchange"> = {
  event: "host.flagchange",

  async do({ runtime, originalEvent }) {
    if (typeof originalEvent.detail.value !== "undefined") {
      await runtime.flags.override(
        originalEvent.detail.flag,
        originalEvent.detail.value
      );
    } else {
      await runtime.flags.clearOverride(originalEvent.detail.flag);
    }
    return false;
  },
};
