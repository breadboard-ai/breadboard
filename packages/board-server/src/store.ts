/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Firestore } from "@google-cloud/firestore";

export const getStore = () => {
  return new Store("board-server");
};

class Store {
  #database;

  constructor(storeName: string) {
    this.#database = new Firestore({
      databaseId: storeName,
    });
  }

  async list() {
    const allStores = await this.#database
      .collection("workspaces")
      .listDocuments();
    const boards = [];
    for (const store of allStores) {
      const storeBoards = await store.collection("boards").listDocuments();
      boards.push(...storeBoards.map((doc) => `${store.id}/${doc.id}`));
    }
    return boards;
  }

  async get(userStore: string, boardName: string) {
    const doc = await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .get();
    return doc.get("graph");
  }

  async create(userStore: string, boardName: string, graph: string) {
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .set({ graph: JSON.stringify(graph), published: true });
  }

  async delete(userStore: string, boardName: string) {
    await this.#database
      .doc(`workspaces/${userStore}/boards/${boardName}`)
      .delete();
  }
}
