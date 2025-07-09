/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlagManager, RuntimeFlags } from "@breadboard-ai/types";
import { DBSchema, IDBPDatabase, openDB } from "idb";

export { IdbFlagManager };

const FLAGS_DB = "flags";

interface FlagOverrides extends DBSchema {
  overrides: {
    key: string;
    value: boolean;
  };
}

class IdbFlagManager implements RuntimeFlagManager {
  #db: Promise<IDBPDatabase<FlagOverrides>>;
  #env: RuntimeFlags;

  constructor(env: RuntimeFlags) {
    this.#env = env;
    this.#db = this.#initialize();
  }

  async flags(): Promise<Readonly<RuntimeFlags>> {
    const overrides = await this.overrides();
    return { ...this.env(), ...overrides };
  }

  async #initialize() {
    return openDB<FlagOverrides>(FLAGS_DB, 1, {
      upgrade(db) {
        db.createObjectStore("overrides");
      },
    });
  }

  env(): Readonly<RuntimeFlags> {
    return this.#env;
  }

  async overrides(): Promise<Partial<Readonly<RuntimeFlags>>> {
    const db = await this.#db;
    const tx = db.transaction(["overrides"], "readonly");
    const flags = tx.objectStore("overrides");
    const [keys, values] = await Promise.all([
      flags.getAllKeys(),
      flags.getAll(),
    ]);
    const result: Record<string, boolean> = {};
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = values[i];
    }
    await tx.done;
    return result;
  }

  async override(flag: keyof RuntimeFlags, value: boolean): Promise<void> {
    const db = await this.#db;
    const tx = db.transaction(["overrides"], "readwrite");
    const flags = tx.objectStore("overrides");
    flags.put(value, flag);
    return tx.done;
  }

  async clearOverride(flag: keyof RuntimeFlags): Promise<void> {
    const db = await this.#db;
    const tx = db.transaction(["overrides"], "readwrite");
    const flags = tx.objectStore("overrides");
    flags.delete(flag);
    return tx.done;
  }
}
