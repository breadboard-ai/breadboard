/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import * as BreadboardUI from "@google-labs/breadboard-ui";
import { SETTINGS_TYPE } from "../../../breadboard-ui/dist/src/types/types";

interface SettingsDB extends BreadboardUI.Types.SettingsList, idb.DBSchema {}

const SETTINGS_NAME = "settings";
const SETTINGS_VERSION = 1;

export class SettingsStore {
  static #instance: SettingsStore;
  static instance() {
    if (!this.#instance) {
      this.#instance = new SettingsStore();
    }
    return this.#instance;
  }

  #settings: BreadboardUI.Types.Settings = {
    [BreadboardUI.Types.SETTINGS_TYPE.GENERAL]: {
      configuration: {
        extensible: false,
        description: `General Breadboard settings`,
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
    [BreadboardUI.Types.SETTINGS_TYPE.SECRETS]: {
      configuration: {
        extensible: true,
        description: `Secrets that you want to store locally, such as API keys. Please note that items in this list should have unique names.`,
        nameEditable: true,
      },
      items: new Map([]),
    },
  };

  get values() {
    return structuredClone(this.#settings);
  }

  getSection(section: SETTINGS_TYPE) {
    return this.#settings[section];
  }

  getItem(section: SETTINGS_TYPE, name: string) {
    return this.#settings[section].items.get(name);
  }

  private constructor() {}

  async save(settings: BreadboardUI.Types.Settings) {
    const settingsDb = await idb.openDB<SettingsDB>(
      SETTINGS_NAME,
      SETTINGS_VERSION
    );

    for (const [store, data] of Object.entries(settings)) {
      const settingsStore = store as BreadboardUI.Types.SETTINGS_TYPE;
      await settingsDb.clear(settingsStore);

      const tx = settingsDb.transaction(settingsStore, "readwrite");
      await Promise.all([
        [...data.items.values()].map((setting) => {
          return tx.store.put(setting);
        }),
        tx.done,
      ]);
    }

    this.#settings = settings;
  }

  async restore() {
    let settingsFound = true;
    const settings = this.#settings;
    const settingsDb = await idb.openDB<SettingsDB>(
      SETTINGS_NAME,
      SETTINGS_VERSION,
      {
        upgrade(db) {
          settingsFound = false;
          for (const groupName of Object.keys(settings)) {
            const name = groupName as BreadboardUI.Types.SETTINGS_TYPE;
            db.createObjectStore(name, {
              keyPath: "id",
              autoIncrement: true,
            });
          }
        },
      }
    );

    for (const store of settingsDb.objectStoreNames) {
      const items = await settingsDb.getAll(store);
      for (const item of items) {
        this.#settings[store].items.set(item.name, item);
      }
    }

    if (!settingsFound) {
      // Store the initial copy of the settings.
      await this.save(this.#settings);
    }
  }
}
