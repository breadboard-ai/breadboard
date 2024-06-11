/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Firestore } from "@google-cloud/firestore";

export type GetUserStoreResult =
  | { success: true; store: string }
  | { success: false; error: string };

export type OperationResult =
  | { success: true }
  | { success: false; error: string };

export const getStore = () => {
  return new Store("board-server");
};

export const asPath = (userStore: string, boardName: string) => {
  return `@${userStore}/${boardName}`;
};

export const sanitize = (name: string) => {
  if (name.endsWith(".bgl.json")) {
    name = name.slice(0, -8);
  } else if (name.endsWith(".json")) {
    name = name.slice(0, -5);
  }
  name = name.replace(/[^a-zA-Z0-9]/g, "-");
  return `${name}.bgl.json`;
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
class Store {
  #database;

  constructor(storeName: string) {
    this.#database = new Firestore({
      databaseId: storeName,
    });
  }

  async getBoardServerCorsConfig(): Promise<BoardServerCorsConfig | undefined> {
    const data = await this.#database
      .collection("configuration")
      .doc("board-server-cors")
      .get();
    const config = data.data() as BoardServerCorsConfig;
    return config;
  }

  async getUserStore(userKey: string | null): Promise<GetUserStoreResult> {
    if (!userKey) {
      return { success: false, error: "No user key supplied" };
    }
    const users = this.#database.collection(`users`);
    const key = await users.where("apiKey", "==", userKey).get();
    if (key.empty) {
      return { success: false, error: "User not found" };
    }
    const doc = key.docs[0];
    if (!doc) {
      return { success: false, error: "User not found" };
    }
    return { success: true, store: doc.id };
  }

  async list(userKey: string | null) {
    const userStoreResult = await this.getUserStore(userKey);
    const userStore = userStoreResult.success ? userStoreResult.store : null;

    const allStores = await this.#database
      .collection("workspaces")
      .listDocuments();
    const boards = [];
    for (const store of allStores) {
      const storeBoards = await store.collection("boards").listDocuments();
      boards.push(
        ...storeBoards.map((doc) => {
          const readonly = userStore !== store.id;
          return { path: asPath(store.id, doc.id), readonly };
        })
      );
    }
    return boards;
  }

  async get(userStore: string, boardName: string) {
    const doc = await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .get();
    return doc.get("graph");
  }

  async update(
    userStore: string,
    path: string,
    graph: string
  ): Promise<OperationResult> {
    const { userStore: pathUserStore, boardName } = asInfo(path);
    if (pathUserStore !== userStore) {
      return { success: false, error: "Unauthorized" };
    }
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .set({ graph: JSON.stringify(graph), published: true });
    return { success: true };
  }

  async create(userKey: string, name: string) {
    const userStore = await this.getUserStore(userKey);
    if (!userStore.success) {
      return { success: false, error: userStore.error };
    }
    const boardName = sanitize(name);
    const path = asPath(userStore.store, boardName);
    return { success: true, path };
  }

  async delete(userStore: string, path: string): Promise<OperationResult> {
    const { userStore: pathUserStore, boardName } = asInfo(path);
    if (pathUserStore !== userStore) {
      return { success: false, error: "Unauthorized" };
    }
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .delete();
    return { success: true };
  }
}
