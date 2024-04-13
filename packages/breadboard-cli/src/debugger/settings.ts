/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// This is currently a duplicate of types in "@google-labs/breadboard-ui"
// and is definitely not the final shape of things.
// TODO: Move all these to "@breadboard-ai/settings" or something like that.

export type SettingValue = {
  id?: string;
  name: string;
  description?: string;
  value: string | number | boolean;
};

export type SettingEntry = {
  key: string;
  value: SettingValue;
};

export enum SETTINGS_TYPE {
  SECRETS = "Secrets",
  GENERAL = "General",
}

export type SettingsList = {
  [SETTINGS_TYPE.GENERAL]: SettingEntry;
  [SETTINGS_TYPE.SECRETS]: SettingEntry;
};

export type SettingsSection = {
  configuration: {
    extensible: boolean;
    description: string;
    nameEditable: boolean;
  };
  items: Map<SettingValue["name"], SettingValue>;
};

export type Settings = {
  [K in keyof SettingsList]: SettingsSection;
};

export type SettingsProvider = {
  values: Settings;
  getSection(section: SETTINGS_TYPE): SettingsSection;
  getItem(section: SETTINGS_TYPE, name: string): SettingValue | undefined;
  save(settings: Settings): Promise<void>;
  restore(): Promise<void>;
};

const SETTINGS_KEY = "bb-settings-store";

const replacer = (key: string, value: unknown) => {
  if (!(value instanceof Map)) return value;
  return { $type: "Map", value: Array.from(value.entries()) };
};

const reviver = (
  key: string,
  value: unknown & {
    $type?: string;
    value: Iterable<readonly [string, unknown]>;
  }
) => {
  const { $type } = (value || {}) as { $type?: string };
  return $type == "Map" && value.value
    ? new Map<string, unknown>(value.value)
    : value;
};

export class DebuggerSettings implements SettingsProvider {
  #settings: Settings = {
    [SETTINGS_TYPE.GENERAL]: {
      configuration: {
        extensible: false,
        description: "General",
        nameEditable: false,
      },
      items: new Map([
        [
          "Save Secrets",
          {
            name: "Save Secrets",
            description: "Whether you wish to have secrets saved automatically",
            value: true,
          },
        ],
      ]),
    },
    [SETTINGS_TYPE.SECRETS]: {
      configuration: {
        extensible: true,
        description: "Secrets",
        nameEditable: true,
      },
      items: new Map(),
    },
  };

  get values() {
    return structuredClone(this.#settings);
  }

  getItem(section: SETTINGS_TYPE, name: string): SettingValue | undefined {
    return this.#settings[section].items.get(name);
  }

  getSection(section: SETTINGS_TYPE): SettingsSection {
    return this.#settings[section];
  }

  async save(settings: Settings): Promise<void> {
    const json = JSON.stringify(settings, replacer);
    globalThis.localStorage.setItem(SETTINGS_KEY, json);
  }

  async restore(): Promise<void> {
    const value = globalThis.localStorage.getItem(SETTINGS_KEY);
    if (!value) return undefined;
    this.#settings = JSON.parse(value, reviver);
  }
}
