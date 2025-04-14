/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SETTINGS_TYPE,
  SettingsStore,
} from "@breadboard-ai/shared-ui/types/types.js";
import { FileSystemEntry } from "@google-labs/breadboard";

export { envFromSettings };

function envFromSettings(settings: SettingsStore | null): FileSystemEntry[] {
  if (!settings) return [];

  const json = Object.fromEntries(
    [...settings.getSection(SETTINGS_TYPE.GENERAL).items.entries()].map(
      ([name, entry]) => [name, entry.value]
    )
  );

  return [
    {
      path: `/env/settings/general`,
      data: [{ parts: [{ json }] }],
    },
  ];
}
