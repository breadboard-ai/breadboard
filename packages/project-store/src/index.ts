/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type * from "./types/types.js";
export { LocalStore } from "./local-store/local-store.js";

import * as idb from "idb";
import { ProjectStore, User } from "./types/types.js";
import { LocalStore } from "./local-store/local-store.js";

const STORE_LISTING_DB = "project-stores";
const STORE_LISTING_VERSION = 1;

interface StoreListing extends idb.DBSchema {
  stores: {
    key: "url";
    value: {
      url: string;
      user: User;
    };
  };
}

export async function getStores(): Promise<ProjectStore[]> {
  const db = await idb.openDB<StoreListing>(
    STORE_LISTING_DB,
    STORE_LISTING_VERSION,
    {
      upgrade(db) {
        db.createObjectStore("stores", { keyPath: "url" });
      },
    }
  );

  const storeUrls = await db.getAll("stores");
  db.close();

  const stores = await Promise.all(
    storeUrls.map(({ url, user }) => {
      if (url.startsWith(LocalStore.PROTOCOL)) {
        return LocalStore.from(url, user);
      }

      throw new Error(`Unsupported store URL: ${url}`);
    })
  );

  return stores.filter((store) => store !== null);
}

export async function createDefaultLocalProjectStore() {
  try {
    const db = await idb.openDB<StoreListing>(
      STORE_LISTING_DB,
      STORE_LISTING_VERSION,
      {
        upgrade(db) {
          db.createObjectStore("stores", { keyPath: "url" });
        },
      }
    );
    const url = `${LocalStore.PROTOCOL}project-stores-local`;
    const user = {
      username: "board-builder",
      apiKey: "breadboard",
      secrets: new Map(),
    };

    await db.put("stores", { url, user });
    await LocalStore.createDefault(new URL(url), user);
  } catch (err) {
    console.warn(err);
  }
}
