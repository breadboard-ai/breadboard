/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { SettingsStore } from "./settings-store.js";

export class SettingsHelperImpl implements BreadboardUI.Types.SettingsHelper {
  #store: SettingsStore;

  constructor(store: SettingsStore) {
    this.#store = store;
  }

  get(
    section: BreadboardUI.Types.SETTINGS_TYPE,
    name: string
  ): BreadboardUI.Types.SettingEntry["value"] | undefined {
    return this.#store.values[section].items.get(name);
  }

  async set(
    section: BreadboardUI.Types.SETTINGS_TYPE,
    name: string,
    value: BreadboardUI.Types.SettingEntry["value"]
  ): Promise<void> {
    const values = this.#store.values;
    values[section].items.set(name, value);
    await this.#store.save(values);
  }

  async delete(
    section: BreadboardUI.Types.SETTINGS_TYPE,
    name: string
  ): Promise<void> {
    const values = this.#store.values;
    values[section].items.delete(name);
    await this.#store.save(values);
  }
}
