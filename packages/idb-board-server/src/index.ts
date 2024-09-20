/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import { IDBBoardServer } from "./idb-board-server.js";
import { BoardServer, User } from "@google-labs/breadboard";

export { IDBBoardServer } from "./idb-board-server.js";

const BOARD_SERVER_LISTING_DB = "board-server";
const BOARD_SERVER_LISTING_VERSION = 1;

interface BoardServerListing extends idb.DBSchema {
  servers: {
    key: "url";
    value: {
      url: string;
      user: User;
    };
  };
}

export async function getBoardServers(): Promise<BoardServer[]> {
  const db = await idb.openDB<BoardServerListing>(
    BOARD_SERVER_LISTING_DB,
    BOARD_SERVER_LISTING_VERSION,
    {
      upgrade(db) {
        db.createObjectStore("servers", { keyPath: "url" });
      },
    }
  );

  const storeUrls = await db.getAll("servers");
  db.close();

  const stores = await Promise.all(
    storeUrls.map(({ url, user }) => {
      if (url.startsWith(IDBBoardServer.PROTOCOL)) {
        return IDBBoardServer.from(url, user);
      }

      throw new Error(`Unsupported store URL: ${url}`);
    })
  );

  return stores.filter((store) => store !== null);
}

export async function createDefaultLocalBoardServer() {
  try {
    const db = await idb.openDB<BoardServerListing>(
      BOARD_SERVER_LISTING_DB,
      BOARD_SERVER_LISTING_VERSION,
      {
        upgrade(db) {
          db.createObjectStore("servers", { keyPath: "url" });
        },
      }
    );
    const url = `${IDBBoardServer.PROTOCOL}board-server-local`;
    const user = {
      username: "board-builder",
      apiKey: "breadboard",
      secrets: new Map(),
    };

    await db.put("servers", { url, user });
    await IDBBoardServer.createDefault(new URL(url), user);
  } catch (err) {
    console.warn(err);
  }
}
