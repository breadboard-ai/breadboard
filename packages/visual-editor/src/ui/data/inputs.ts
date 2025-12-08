/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsStore, SETTINGS_TYPE } from "../types/types.js";

export const inputsFromSettings = (settings: SettingsStore | null) => {
  if (!settings) return undefined;

  const inputsSection = settings.getSection(SETTINGS_TYPE.INPUTS);
  if (!inputsSection) return undefined;
  const values = Array.from(inputsSection.items.values());
  if (!values.length) return undefined;

  return Object.fromEntries(
    values.map((item) => {
      return [item.name, item.value];
    })
  );
};
