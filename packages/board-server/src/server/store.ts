/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SQLiteStorageProvider } from "./storage-providers/sqlite.js";
import { FirestoreStorageProvider } from "./storage-providers/firestore.js";

export const EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 2; // 2 days
export const INVITE_EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 4; // 4 days

export type GetUserStoreResult =
  | { success: true; store: string }
  | { success: false; error: string };

export type OperationResult =
  | { success: true }
  | { success: false; error: string };

// Use factories here, so that the providers are only instantiated
// when chosen.
const providers = {
  sqlite: () =>
    new SQLiteStorageProvider(
      process.env["SQLITE_DB_PATH"] || "board-server.db"
    ),
  firestore: () =>
    new FirestoreStorageProvider(
      process.env["FIRESTORE_DB_NAME"] || "board-server"
    ),
};

export const getStore = () => {
  const backend = process.env["STORAGE_BACKEND"];
  const provider = providers[backend === "sqlite" ? "sqlite" : "firestore"];
  return provider();
};

const createAPIKey = async () => {
  const uuid = crypto.randomUUID();
  const data = new TextEncoder().encode(uuid);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(36)).join("");
  return `bb-${hashHex.slice(0, 50)}`;
};

export async function createAccount(username: string, key?: string) {
  const store = getStore();

  key ??= await createAPIKey();

  await store!.createUser(username, key);

  return { account: username, api_key: key };
}

export type BoardListEntry = {
  title: string;
  description?: string;
  path: string;
  username: string;
  readonly: boolean;
  mine: boolean;
  tags: string[];
};

export type ServerCapabilityAccess = "open" | "key";

export type ServerCapabilityInfo = {
  path: string;
  read: ServerCapabilityAccess;
  write: ServerCapabilityAccess;
};

export type ServerCapability = "boards" | "proxy";

export type ServerInfo = {
  title?: string;
  description?: string;
  capabilities?: Partial<Record<ServerCapability, ServerCapabilityInfo>>;
  /**
   * The URL of the server
   */
  url?: string;
};

export const asPath = (userStore: string, boardName: string) => {
  return `@${userStore}/${boardName}`;
};

export const sanitize = (name: string) => {
  if (name.endsWith(".bgl.json")) {
    name = name.slice(0, -9);
  } else if (name.endsWith(".json")) {
    name = name.slice(0, -5);
  }
  name = name.replace(/[^a-zA-Z0-9]/g, "-");
  return name;
};

export const asInfo = (path: string) => {
  const [userStore, boardName] = path.split("/");
  if (!userStore || userStore[0] !== "@") {
    return {};
  }
  return { userStore: userStore.slice(1), boardName };
};
