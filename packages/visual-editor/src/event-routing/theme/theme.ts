/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";

export const CreateRoute: EventRoute<"theme.create"> = {
  event: "theme.create",

  async do({ runtime, tab, originalEvent }) {
    runtime.edit.createTheme(tab, originalEvent.detail.theme);
    return false;
  },
};

export const DeleteRoute: EventRoute<"theme.delete"> = {
  event: "theme.delete",

  async do({ runtime, tab, originalEvent }) {
    runtime.edit.deleteTheme(tab, originalEvent.detail.id);
    return false;
  },
};

export const UpdateRoute: EventRoute<"theme.update"> = {
  event: "theme.update",

  async do({ runtime, tab, originalEvent }) {
    runtime.edit.updateTheme(
      tab,
      originalEvent.detail.id,
      originalEvent.detail.theme
    );
    return false;
  },
};

export const ChangeRoute: EventRoute<"theme.change"> = {
  event: "theme.change",

  async do({ runtime, tab, originalEvent }) {
    runtime.edit.changeTheme(tab, originalEvent.detail.id);
    return false;
  },
};
