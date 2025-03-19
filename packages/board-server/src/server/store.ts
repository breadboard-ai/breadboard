/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  ReanimationState,
} from "@google-labs/breadboard";

export const EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 2; // 2 days

/** A type representing a board as it is stored in a DB. */
export type StorageBoard = {
  name: string;
  owner: string;
  displayName: string;
  description: string;
  tags: string[];
  thumbnail: string;
  graph?: GraphDescriptor;
};

export interface BoardServerStore {
  /** Get basic information about this server. */
  getServerInfo(): Promise<ServerInfo | null>;

  /**
   * Create a new user with the given API key.
   *
   * @throws If user exists
   */
  createUser(userId: string, apiKey: string): Promise<void>;

  /**
   * Look up the user with the given API key.
   *
   * @returns The user ID, or empty string if not found
   */
  findUserIdByApiKey(apiKey: string): Promise<string>;

  /** Load a board by name */
  loadBoard(userId: string, name: string): Promise<StorageBoard | null>;

  /** List all boards visible to the given user. */
  listBoards(userId: string): Promise<StorageBoard[]>;

  /**
   * Create a blank board with no graph.
   *
   * TODO This shouldn't really be necessary, we can just use "update"
   */
  createBoard(userId: string, name: string): Promise<void>;

  /** Updates the given board. Creates if it doesn't exist. */
  updateBoard(board: StorageBoard): Promise<void>;

  /** Deletes a board by name */
  deleteBoard(userId: string, boardName: string): Promise<void>;

  loadReanimationState(
    user: string,
    ticket: string
  ): Promise<ReanimationState | undefined>;

  saveReanimationState(user: string, state: ReanimationState): Promise<string>;
}

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
