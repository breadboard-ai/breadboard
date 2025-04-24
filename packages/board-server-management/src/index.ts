/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import { IDBBoardServer } from "@breadboard-ai/idb-board-server";
import { BoardServer, GraphDescriptor, User } from "@google-labs/breadboard";
import {
  ConnectionArgs,
  getSigninToken,
  RemoteBoardServer,
} from "@breadboard-ai/remote-board-server";
import {
  FileSystemBoardServer,
  type FileSystemDirectoryHandle,
} from "@breadboard-ai/filesystem-board-server";

import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import { TokenVendor } from "@breadboard-ai/connection-client";

const BOARD_SERVER_LISTING_DB = "board-server";
const BOARD_SERVER_LISTING_VERSION = 1;

type Auth = { clientId: string; accessToken: string };

interface BoardServerItem {
  url: string;
  title: string;
  user: User;
  handle?: FileSystemDirectoryHandle;
  auth?: Auth;
}

interface BoardServerListing extends idb.DBSchema {
  servers: {
    key: "url";
    value: BoardServerItem;
  };
}

export async function getBoardServers(
  tokenVendor?: TokenVendor
): Promise<BoardServer[]> {
  const storeUrls = await readAllServers();

  const stores = await Promise.all(
    storeUrls.map(({ url, title, user, handle }) => {
      if (url.startsWith(IDBBoardServer.PROTOCOL)) {
        return IDBBoardServer.from(url, title, user);
      }

      if (
        url.startsWith(RemoteBoardServer.PROTOCOL) ||
        url.startsWith(RemoteBoardServer.LOCALHOST)
      ) {
        return RemoteBoardServer.from(url, title, user, tokenVendor);
      }

      if (url.startsWith(FileSystemBoardServer.PROTOCOL)) {
        return FileSystemBoardServer.from(url, title, user, handle);
      }

      if (url.startsWith(GoogleDriveBoardServer.PROTOCOL) && tokenVendor) {
        return GoogleDriveBoardServer.from(url, title, user, tokenVendor);
      }

      console.warn(`Unsupported store URL: ${url}`);
      return null;
    })
  );

  return stores.filter((store) => store !== null);
}

export async function connectToBoardServer(
  location?: string,
  apiKey?: string,
  tokenVendor?: TokenVendor
): Promise<{ title: string; url: string } | null> {
  const existingServers = await getBoardServers(tokenVendor);
  if (location) {
    if (
      location.startsWith(RemoteBoardServer.PROTOCOL) ||
      location.startsWith(RemoteBoardServer.LOCALHOST)
    ) {
      const existingServer = existingServers.find(
        (server) => server.url.origin === location
      );

      if (existingServer) {
        console.warn("Server already connected");
        return null;
      }

      const args: ConnectionArgs = apiKey
        ? {
            key: apiKey,
          }
        : {
            token: await getSigninToken(tokenVendor),
          };
      const response = await RemoteBoardServer.connect(location, args);
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
    } else if (location.startsWith(GoogleDriveBoardServer.PROTOCOL)) {
      const existingServer = existingServers.find(
        (server) => server.url.protocol === location
      );
      if (existingServer) {
        console.warn("Server already connected");
      }

      if (!tokenVendor) {
        return null;
      }

      const url = new URL(location);
      const response = await GoogleDriveBoardServer.connect(
        url.hostname,
        tokenVendor
      );
      if (response) {
        await storeBoardServer(url, response.title, {
          apiKey: apiKey ?? "",
          secrets: new Map(),
          username: response.username,
        });

        return { title: response.title, url: url.href };
      }

      return null;
    }
    // Unknown location + protocol combination.
    return null;
  } else {
    // No location -- presume file system board server.
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

function getServersDb(): Promise<idb.IDBPDatabase<BoardServerListing>> {
  return idb.openDB<BoardServerListing>(
    BOARD_SERVER_LISTING_DB,
    BOARD_SERVER_LISTING_VERSION,
    {
      upgrade(db) {
        db.createObjectStore("servers", { keyPath: "url" });
      },
    }
  );
}

async function readAllServers(): Promise<BoardServerItem[]> {
  const db = await getServersDb();
  try {
    return db.getAll("servers");
  } finally {
    db.close();
  }
}

export async function getGoogleDriveBoardService(): Promise<
  BoardServerItem | undefined
> {
  const services = await readAllServers();
  return services.find((service) =>
    service.url.startsWith(GoogleDriveBoardServer.PROTOCOL)
  );
}

export async function disconnectFromBoardServer(location: string) {
  const db = await getServersDb();
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
  const db = await getServersDb();

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

    await IDBBoardServer.createDefault(new URL(url), user);
    await storeBoardServer(new URL(url), "Browser Storage", user);
  } catch (err) {
    console.warn(err);
  }
}

export async function legacyGraphProviderExists() {
  const db = await idb.openDB("default");
  try {
    await db.getAll("graphs");
  } catch (err) {
    return false;
  }

  return true;
}

export async function migrateIDBGraphProviders() {
  try {
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
  } catch (err) {
    // No default database - nothing to migrate.
    return;
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

export { BoardServerAwareDataStore } from "./board-server-aware-data-store";
