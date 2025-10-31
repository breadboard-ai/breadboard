/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";

export const ChangeRoute: EventRoute<"theme.change"> = {
  event: "theme.change",

  async do({ runtime, tab, originalEvent, uiState }) {
    uiState.blockingAction = true;
    await runtime.edit.changeTheme(tab, originalEvent.detail.id);
    uiState.blockingAction = false;

    return false;
  },
};
