/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { FirestoreStorageProvider } from "./storage-providers/firestore.js";

export const EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 2; // 2 days
export const INVITE_EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 4; // 4 days

export function getStore(): FirestoreStorageProvider {
  const db = process.env["FIRESTORE_DB_NAME"] || "board-server";
  return new FirestoreStorageProvider(db);
}

/** A type representing a board as it is stored in a DB. */
export type StorageBoard = {
  name: string;
  owner: string;
  displayName: string;
  description: string;
  tags: string[];
  graph?: GraphDescriptor;
};

export type BoardListEntry = {
  title: string;
  description?: string;
  path: string;
  username: string;
  readonly: boolean;
  mine: boolean;
  tags: string[];
  thumbnail?: string;
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

export const asInfo = (path: string) => {
  const [userStore, boardName] = path.split("/");
  if (!userStore || userStore[0] !== "@") {
    return {};
  }
  return { userStore: userStore.slice(1), boardName };
};
