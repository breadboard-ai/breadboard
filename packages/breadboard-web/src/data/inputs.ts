/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsStore } from "./settings-store";
import * as BreadboardUI from "@google-labs/breadboard-ui";

export const inputsFromSettings = (settings: SettingsStore | null) => {
  if (!settings) return undefined;

  const inputsSection = settings.getSection(
    BreadboardUI.Types.SETTINGS_TYPE.INPUTS
  );
  const values = Array.from(inputsSection.items.values());
  if (!values.length) return undefined;

  return Object.fromEntries(
    values.map((item) => {
      return [item.name, item.value];
    })
  );
};
