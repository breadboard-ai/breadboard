/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";

export const CreateRoute: EventRoute<"theme.create"> = {
  event: "theme.create",

  async do({ runtime, tab, originalEvent, uiState }) {
    uiState.blockingAction = true;
    await runtime.edit.createTheme(tab, originalEvent.detail.theme);
    uiState.blockingAction = false;
    return false;
  },
};

export const DeleteRoute: EventRoute<"theme.delete"> = {
  event: "theme.delete",

  async do({ runtime, tab, originalEvent, uiState }) {
    uiState.blockingAction = true;
    await runtime.edit.deleteTheme(tab, originalEvent.detail.id);
    uiState.blockingAction = false;
    return false;
  },
};

export const UpdateRoute: EventRoute<"theme.update"> = {
  event: "theme.update",

  async do({ runtime, tab, originalEvent, uiState }) {
    uiState.blockingAction = true;
    await runtime.edit.updateTheme(
      tab,
      originalEvent.detail.id,
      originalEvent.detail.theme
    );
    uiState.blockingAction = false;

    return false;
  },
};

export const ChangeRoute: EventRoute<"theme.change"> = {
  event: "theme.change",

  async do({ runtime, tab, originalEvent, uiState }) {
    uiState.blockingAction = true;
    await runtime.edit.changeTheme(tab, originalEvent.detail.id);
    uiState.blockingAction = false;

    return false;
  },
};
