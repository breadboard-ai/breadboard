/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";

const SETTINGS_KEY = "app-settings";

type Settings = {
  [section: string]: {
    [name: string]: BreadboardUI.Types.SettingEntry["value"];
  };
};

export class AppSettingsHelper implements BreadboardUI.Types.SettingsHelper {
  get(
    section: BreadboardUI.Types.SETTINGS_TYPE,
    name: string
  ): BreadboardUI.Types.SettingEntry["value"] | undefined {
    const settings = localStorage.getItem(SETTINGS_KEY);
    if (!settings) {
      return undefined;
    }
    const parsedSettings = JSON.parse(settings);
    return parsedSettings[section]?.[name];
  }
  async set(
    section: BreadboardUI.Types.SETTINGS_TYPE,
    name: string,
    value: BreadboardUI.Types.SettingEntry["value"]
  ): Promise<void> {
    const settings = localStorage.getItem(SETTINGS_KEY);
    let parsedSettings: Settings = {};
    if (settings) {
      parsedSettings = JSON.parse(settings);
    }
    if (!parsedSettings[section]) {
      parsedSettings[section] = {};
    }
    parsedSettings[section][name] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsedSettings));
  }
  async delete(
    section: BreadboardUI.Types.SETTINGS_TYPE,
    name: string
  ): Promise<void> {
    const settings = localStorage.getItem(SETTINGS_KEY);
    if (!settings) {
      return;
    }
    const parsedSettings = JSON.parse(settings);
    if (!parsedSettings[section]) {
      return;
    }
    delete parsedSettings[section][name];
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsedSettings));
  }
}
