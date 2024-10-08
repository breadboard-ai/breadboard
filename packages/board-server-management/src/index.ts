/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import { IDBBoardServer } from "@breadboard-ai/idb-board-server";
import { BoardServer, GraphDescriptor, User } from "@google-labs/breadboard";
import { RemoteBoardServer } from "@breadboard-ai/remote-board-server";
import { ExampleBoardServer } from "@breadboard-ai/example-board-server";
import {
  FileSystemBoardServer,
  type FileSystemDirectoryHandle,
} from "@breadboard-ai/filesystem-board-server";

import { loadKits } from "./utils/kit-loader.js";
import GeminiKit from "@google-labs/gemini-kit";
import PythonWasmKit from "@breadboard-ai/python-wasm";
import GoogleDriveKit from "@breadboard-ai/google-drive-kit";
const loadedKits = loadKits([GeminiKit, PythonWasmKit, GoogleDriveKit]);

const PLAYGROUND_BOARDS = "example://playground-boards";
const EXAMPLE_BOARDS = "example://example-boards";
const BOARD_SERVER_LISTING_DB = "board-server";
const BOARD_SERVER_LISTING_VERSION = 1;

interface BoardServerItem {
  url: string;
  title: string;
  user: User;
  handle?: FileSystemDirectoryHandle;
}

interface BoardServerListing extends idb.DBSchema {
  servers: {
    key: "url";
    value: BoardServerItem;
  };
}

export async function getBoardServers(
  skipPlaygroundExamples = false
): Promise<BoardServer[]> {
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

  // TODO: Figure out a better solution for kits. As it stands we duplicate
  // the kits across all of the Board Servers, so we can afford to load them
  // in here and then populate the Board Servers with them. If we devolve it to
  // the Board Server entirely then each one would load a separate copy of the
  // same kits.
  const kits = await loadedKits;

  const stores = await Promise.all(
    storeUrls.map(({ url, title, user, handle }) => {
      if (url.startsWith(IDBBoardServer.PROTOCOL)) {
        return IDBBoardServer.from(url, title, user, kits);
      }

      if (url.startsWith(RemoteBoardServer.PROTOCOL)) {
        return RemoteBoardServer.from(url, title, user, kits);
      }

      if (url.startsWith(ExampleBoardServer.PROTOCOL)) {
        if (url === PLAYGROUND_BOARDS && skipPlaygroundExamples) {
          return null;
        }

        return ExampleBoardServer.from(url, title, user, kits);
      }

      if (url.startsWith(FileSystemBoardServer.PROTOCOL)) {
        return FileSystemBoardServer.from(url, title, user, kits, handle);
      }

      console.warn(`Unsupported store URL: ${url}`);
      return null;
    })
  );

  return stores.filter((store) => store !== null);
}

export async function connectToBoardServer(
  location?: string,
  apiKey?: string
): Promise<{ title: string; url: string } | null> {
  const existingServers = await getBoardServers();
  if (location && location.startsWith(RemoteBoardServer.PROTOCOL)) {
    const existingServer = existingServers.find(
      (server) => server.url.origin === location
    );

    if (existingServer) {
      console.warn("Server already connected");
      return null;
    }

    const response = await RemoteBoardServer.connect(location, apiKey);
    if (response) {
      const url = new URL(location);
      await storeBoardServer(url, response.title, {
        apiKey: apiKey ?? "",
        secrets: new Map(),
        username: response.username,
      });
      return { title: response.title, url: url.href };
    }

    return null;
  } else {
    const handle = await FileSystemBoardServer.connect();
    if (!handle) {
      return null;
    }

    const url = FileSystemBoardServer.createURL(handle.name);
    const boardServerUrl = new URL(url);
    const existingServer = existingServers.find((server) => {
      return server.url.href === boardServerUrl.href;
    });

    if (existingServer) {
      console.warn("Server already connected");
      return null;
    }

    try {
      await storeBoardServer(
        boardServerUrl,
        handle.name,
        {
          apiKey: apiKey ?? "",
          secrets: new Map(),
          username: "board-builder",
        },
        handle
      );

      return { title: handle.name, url };
    } catch (err) {
      console.warn(err);
      return null;
    }
  }
}

export async function disconnectFromBoardServer(location: string) {
  const db = await idb.openDB<BoardServerListing>(
    BOARD_SERVER_LISTING_DB,
    BOARD_SERVER_LISTING_VERSION,
    {
      upgrade(db) {
        db.createObjectStore("servers", { keyPath: "url" });
      },
    }
  );

  const url = new URL(location);
  await db.delete("servers", IDBKeyRange.only(url.href));
  db.close();
  return true;
}

async function storeBoardServer(
  url: URL,
  title: string,
  user: User,
  handle?: FileSystemDirectoryHandle
) {
  const db = await idb.openDB<BoardServerListing>(
    BOARD_SERVER_LISTING_DB,
    BOARD_SERVER_LISTING_VERSION,
    {
      upgrade(db) {
        db.createObjectStore("servers", { keyPath: "url" });
      },
    }
  );

  const server: BoardServerItem = { url: url.href, title, user };
  if (handle) {
    server["handle"] = handle;
  }

  await db.put("servers", server);
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

    const kits = await loadedKits;
    await IDBBoardServer.createDefault(new URL(url), user, kits);
    await storeBoardServer(new URL(url), "Browser Storage", user);
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

const REMOTE_GRAPH_PROVIDER = "remote-store-list";
const REMOTE_GRAPH_PROVIDER_VERSION = 1;

export async function migrateRemoteGraphProviders() {
  const db = await idb.openDB<RemoteGraphProviderStoreList>(
    REMOTE_GRAPH_PROVIDER,
    REMOTE_GRAPH_PROVIDER_VERSION,
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
  db.close();

  for (const store of stores) {
    const user = {
      // TODO: Replace this with the actual username.
      username: "board-builder",
      apiKey: store.apiKey,
      secrets: new Map(),
    };

    const url = new URL(store.url);
    await storeBoardServer(url, url.href, user);
  }
}

const FILE_SYSTEM_PROVIDER = "keyval-store";
const FILE_SYSTEM_PROVIDER_VERSION = 1;

interface FileSystemProviderStoreList extends idb.DBSchema {
  keyval: {
    key: string;
    value: FileSystemDirectoryHandle;
  };
}

export async function migrateFileSystemProviders() {
  const db = await idb.openDB<FileSystemProviderStoreList>(
    FILE_SYSTEM_PROVIDER,
    FILE_SYSTEM_PROVIDER_VERSION,
    {
      upgrade(database) {
        database.createObjectStore("keyval", {
          keyPath: "Key",
          autoIncrement: true,
        });
      },
    }
  );

  const stores = await db.getAll("keyval");
  db.close();

  for (const store of stores) {
    const user = {
      username: "board-builder",
      apiKey: "",
      secrets: new Map(),
    };

    const url = FileSystemBoardServer.createURL(store.name);
    await storeBoardServer(new URL(url), store.name, user, store);
  }
  db.close();
}

export async function migrateExampleGraphProviders() {
  const user = {
    // TODO: Replace this with the actual username.
    username: "example-board-builder",
    apiKey: "",
    secrets: new Map(),
  };

  await storeBoardServer(new URL(EXAMPLE_BOARDS), "Example Boards", user);
  await storeBoardServer(new URL(PLAYGROUND_BOARDS), "Playground Boards", user);
}
