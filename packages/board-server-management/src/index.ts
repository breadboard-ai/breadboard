/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import { IDBBoardServer } from "@breadboard-ai/idb-board-server";
import { BoardServer, GraphDescriptor, User } from "@google-labs/breadboard";
import { RemoteBoardServer } from "@breadboard-ai/remote-board-server";

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

      if (url.startsWith(RemoteBoardServer.PROTOCOL)) {
        return RemoteBoardServer.from(url, user);
      }

      console.warn(`Unsupported store URL: ${url}`);
      return null;
    })
  );

  return stores.filter((store) => store !== null);
}

export async function createBoardServer(url: URL, user: User) {
  const db = await idb.openDB<BoardServerListing>(
    BOARD_SERVER_LISTING_DB,
    BOARD_SERVER_LISTING_VERSION,
    {
      upgrade(db) {
        db.createObjectStore("servers", { keyPath: "url" });
      },
    }
  );

  await db.put("servers", { url: url.href, user });
  db.close();
}

export async function createDefaultLocalBoardServer() {
  try {
    const url = `${IDBBoardServer.PROTOCOL}board-server-local`;
    const user = {
      username: "board-builder",
      apiKey: "breadboard",
      secrets: new Map(),
    };

    await createBoardServer(new URL(url), user);
    await IDBBoardServer.createDefault(new URL(url), user);
  } catch (err) {
    console.warn(err);
  }
}

export async function migrateIDBGraphProviders() {
  const db = await idb.openDB("default");
  const graphs: GraphDescriptor[] = await db.getAll("graphs");
  db.close();

  const boardServers = await getBoardServers();
  const idbBoardServer = boardServers.find(
    (bbs) => bbs.name === "Browser Storage"
  );

  if (idbBoardServer) {
    for (let i = 0; i < graphs.length; i++) {
      const descriptor = graphs[i];
      const boardSlug = descriptor.url?.split("/").at(-1) ?? "board.bgl.json";
      const boardUrl = new URL(
        `${idbBoardServer.url.href}/project-${i}/${boardSlug}`
      );

      await idbBoardServer.create(boardUrl, descriptor);
    }
  } else {
    console.warn("Unable to find local Board Server");
  }
}

interface RemoteGraphProviderStore {
  url: string;
  apiKey: string;
}

interface RemoteGraphProviderStoreList extends idb.DBSchema {
  stores: {
    key: string;
    value: RemoteGraphProviderStore;
  };
}

const STORE_LIST = "remote-store-list";
const STORE_LIST_VERSION = 1;

export async function migrateRemoteGraphProviders() {
  const db = await idb.openDB<RemoteGraphProviderStoreList>(
    STORE_LIST,
    STORE_LIST_VERSION,
    {
      upgrade(database) {
        database.createObjectStore("stores", {
          keyPath: "id",
          autoIncrement: true,
        });
      },
    }
  );

  const stores = await db.getAll("stores");
  for (const store of stores) {
    const user = {
      // TODO: Replace this with the actual username.
      username: "board-builder",
      apiKey: store.apiKey,
      secrets: new Map(),
    };

    await createBoardServer(new URL(store.url), user);
  }
  db.close();
}
