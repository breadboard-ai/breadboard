/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Firestore } from "@google-cloud/firestore";

export const getStore = () => {
  return new Store("board-server");
};

export const asPath = (userStore: string, boardName: string) => {
  return `@${userStore}/${boardName}`;
};

export const sanitize = (name: string) => {
  return name.replace(/[^a-zA-Z0-9]/g, "-");
};

export const asInfo = (path: string) => {
  const [userStore, boardName] = path.split("/");
  if (!userStore || userStore[0] !== "@") {
    return {};
  }
  return { userStore: userStore.slice(1), boardName };
};
class Store {
  #database;

  constructor(storeName: string) {
    this.#database = new Firestore({
      databaseId: storeName,
    });
  }

  async getUserStore(userKey: string) {
    const users = this.#database.collection(`users`);
    const key = await users.where("apiKey", "==", userKey).get();
    if (key.empty) {
      return { success: false, error: "User not found" };
    }
    const doc = key.docs[0];
    if (!doc) {
      return { success: false, error: "User not found" };
    }
    return doc.get("store");
  }

  async list() {
    const allStores = await this.#database
      .collection("workspaces")
      .listDocuments();
    const boards = [];
    for (const store of allStores) {
      const storeBoards = await store.collection("boards").listDocuments();
      boards.push(...storeBoards.map((doc) => asPath(store.id, doc.id)));
    }
    return boards;
  }

  async get(userStore: string, boardName: string) {
    const doc = await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .get();
    return doc.get("graph");
  }

  async update(userStore: string, boardName: string, graph: string) {
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .set({ graph: JSON.stringify(graph), published: true });
  }

  async create(userKey: string, name: string, graph: string) {
    const userStore = await this.getUserStore(userKey);
    if (!userStore.success) {
      return { error: userStore.error };
    }
    const boardName = sanitize(name);
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .set({ graph: JSON.stringify(graph), published: false });
    return { success: true, path: asPath(userStore, boardName) };
  }

  async delete(userStore: string, boardName: string) {
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .delete();
  }
}
