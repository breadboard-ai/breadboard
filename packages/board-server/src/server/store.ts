/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SQLiteStorageProvider } from "./storage-providers/sqlite.js"
import { FirestoreStorageProvider } from "./storage-providers/firestore.js"
import type { RunBoardStateStore } from "./types.js";

export const EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 2; // 2 days
export const INVITE_EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 4; // 4 days

export type GetUserStoreResult =
  | { success: true; store: string }
  | { success: false; error: string };

export type OperationResult =
  | { success: true }
  | { success: false; error: string };

const providers: Map<string, RunBoardStateStore> = new Map<string, RunBoardStateStore>([
  ["sqlite", new SQLiteStorageProvider('board-server.db')],
  ["firestore", new FirestoreStorageProvider('board-server')]
])

export const getStore = () => {
  return providers.get('sqlite')
};

export type BoardListEntry = {
  title: string;
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

export type BoardServerCorsConfig = {
  allow: string[];
};