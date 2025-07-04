/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";

export const ModeRoute: EventRoute<"host.modetoggle"> = {
  event: "host.modetoggle",

  async do({ runtime, originalEvent }) {
    runtime.router.go(window.location.href, originalEvent.detail.mode);
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
