/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onThemeChange } from "./triggers.js";
import type { ThemeMode } from "../../types.js";

export const bind = makeAction();

export const applyTheme = asAction(
  "Theme.applyTheme",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onThemeChange(),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const mode = controller.theme.mode;

    if (mode === "dark" || mode === "light") {
      document.body.classList.toggle("dark-theme", mode === "dark");
      document.body.classList.toggle("light-theme", mode === "light");
    } else {
      document.body.classList.remove("light-theme", "dark-theme");
    }
  }
);

export const setTheme = asAction(
  "Theme.setTheme",
  { mode: ActionMode.Immediate },
  async (mode: ThemeMode): Promise<void> => {
    const { controller } = bind;
    controller.theme.mode = mode;
  }
);
