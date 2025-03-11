/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SettingEntry,
  SETTINGS_TYPE,
  SettingsHelper,
} from "@breadboard-ai/shared-ui/types/types.js";

export class SettingsHelperImpl implements SettingsHelper {
  get(
    _section: SETTINGS_TYPE,
    name: string
  ): SettingEntry["value"] | undefined {
    try {
      const item = globalThis.sessionStorage.getItem(name);
      if (!item) {
        return undefined;
      }

      return JSON.parse(item);
    } catch (err) {
      return undefined;
    }
  }

  async set(
    _section: SETTINGS_TYPE,
    name: string,
    value: SettingEntry["value"]
  ): Promise<void> {
    globalThis.sessionStorage.setItem(name, JSON.stringify(value));
  }

  async delete(_section: SETTINGS_TYPE, name: string) {
    globalThis.sessionStorage.removeItem(name);
  }
}
