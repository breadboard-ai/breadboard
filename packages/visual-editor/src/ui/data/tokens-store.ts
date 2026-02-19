/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TokenStore — IDB-backed persistence for OAuth token grants.
 *
 * ⚠️  IMPORTANT — IDB store name
 * ──────────────────────────────
 * The underlying IndexedDB database is still called `"settings"` (version 7).
 * This is intentional: renaming it would require a migration and would sign
 * out every existing user whose browser already has the old DB. The class was
 * originally a generic SettingsStore with five sections (General, Secrets,
 * Inputs, Node Proxy Servers, Connections). All sections except Connections
 * turned out to be dead — their values were never read beyond the hard-coded
 * defaults.  The class was therefore narrowed down to the single live section
 * and renamed to TokenStore to better reflect its actual purpose.
 */

import * as idb from "idb";
import * as BreadboardUI_Types from "../types/types.js";

interface TokensDB extends BreadboardUI_Types.TokensList, idb.DBSchema {}

const TOKENS_NAME = "settings";
const TOKENS_VERSION = 7;

export { TokenStore };

class TokenStore {
  static #instance: Promise<TokenStore>;
  static restoredInstance(): Promise<TokenStore> {
    return (this.#instance ??= (async () => {
      const instance = new TokenStore();
      await instance.restore();
      return instance;
    })());
  }

  #tokens: BreadboardUI_Types.Tokens = {
    [BreadboardUI_Types.TOKEN_TYPE.CONNECTIONS]: {
      configuration: {
        extensible: false,
        description:
          "Third-party services boards can access. When you are signed into a service, any board can access and modify your data on that service.",
        nameEditable: false,
        nameVisible: false,
      },
      items: new Map([]),
    },
  };

  get values() {
    return structuredClone(this.#tokens);
  }

  getItem(section: BreadboardUI_Types.TOKEN_TYPE, name: string) {
    return this.#tokens[section]?.items.get(name);
  }

  private constructor() {}

  async saveItem(
    section: BreadboardUI_Types.TOKEN_TYPE,
    value: BreadboardUI_Types.TokenEntry["value"]
  ) {
    const settingsDb = await idb.openDB<TokensDB>(TOKENS_NAME, TOKENS_VERSION);
    const tx = settingsDb.transaction(section, "readwrite");
    tx.store.put(value);
    await tx.done;
    settingsDb.close();
  }

  async save(settings: BreadboardUI_Types.Tokens) {
    const settingsDb = await idb.openDB<TokensDB>(TOKENS_NAME, TOKENS_VERSION);
    const storeNames = (
      Object.keys(settings) as BreadboardUI_Types.TOKEN_TYPE[]
    ).filter((storeName) => {
      const exists = settingsDb.objectStoreNames.contains(storeName);
      if (!exists) {
        console.error(
          `[token-store] Expected IDB object store ` +
            `${JSON.stringify(storeName)} to exist, but it did not. ` +
            `Settings for this store will be lost. A schema upgrade is ` +
            `probably required.`
        );
      }
      return exists;
    });

    const tx = settingsDb.transaction(storeNames, "readwrite");
    await Promise.all(
      storeNames.map(async (storeName) => {
        const store = tx.objectStore(storeName);
        await store.clear();
        const data = settings[storeName];
        await Promise.all(
          [...data.items.values()].map((setting) => store.put(setting))
        );
      })
    );
    tx.commit();
    await tx.done;
    settingsDb.close();
    this.#tokens = settings;
  }

  async restore() {
    const settings = this.#tokens;
    const settingsDb = await idb.openDB<TokensDB>(TOKENS_NAME, TOKENS_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`[token-store] Upgrading IndexedDB`, {
          oldVersion,
          newVersion,
          objectStoreNames: [...db.objectStoreNames],
        });
        for (const groupName of Object.keys(settings)) {
          const name = groupName as BreadboardUI_Types.TOKEN_TYPE;
          if (db.objectStoreNames.contains(name)) continue;
          db.createObjectStore(name, {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      },
    });

    // Only restore the CONNECTIONS section — all other IDB stores are
    // legacy leftovers from the original SettingsStore and are ignored.
    const connectionsStore = BreadboardUI_Types.TOKEN_TYPE.CONNECTIONS;
    if (settingsDb.objectStoreNames.contains(connectionsStore)) {
      const items = await settingsDb.getAll(connectionsStore);
      for (const item of items) {
        this.#tokens[connectionsStore].items.set(item.name, item);
      }
    }

    settingsDb.close();
  }

  async delete() {
    console.log(`[token-store] Deleting ${TOKENS_NAME} IndexedDB`);
    await idb.deleteDB(TOKENS_NAME);
    await this.restore();
  }
}
