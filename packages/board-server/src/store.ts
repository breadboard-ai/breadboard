/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Firestore } from "@google-cloud/firestore";

export class Store {
  #database;

  constructor(storeName: string) {
    this.#database = new Firestore({
      databaseId: storeName,
    });
  }

  async list(userKey: string) {
    const docs = await this.#database
      .collection(`workspaces/${userKey}/boards`)
      .listDocuments();
    return docs.map((doc) => doc.id);
  }

  async get(userKey: string, boardName: string) {
    const doc = await this.#database
      .doc(`workspaces/${userKey}/boards/${boardName}`)
      .get();
    return doc.get("graph");
  }

  async create(userKey: string, boardName: string, graph: string) {
    await this.#database
      .doc(`workspaces/${userKey}/boards/${boardName}`)
      .set({ graph: JSON.stringify(graph), published: true });
  }

  async delete(userKey: string, boardName: string) {
    await this.#database
      .doc(`workspaces/${userKey}/boards/${boardName}`)
      .delete();
  }
}
