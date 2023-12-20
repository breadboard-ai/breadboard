/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Firestore } from "@google-cloud/firestore";

const ONE_DAY = 24 * 60 * 60 * 1000;

export class Store {
  #db;

  constructor(storeName: string) {
    this.#db = new Firestore({
      databaseId: storeName,
    });
  }

  async loadBoardState(ticket: string) {
    if (!ticket) return undefined;

    const docRef = this.#db.collection("states").doc(ticket);
    const doc = await docRef.get();
    if (!doc.exists) return undefined;

    return doc.data()?.state;
  }

  async saveBoardState(previousTicket: string, state: unknown) {
    const docRef = this.#db.collection("states").doc();
    const expires = new Date(Date.now() + ONE_DAY);
    await docRef.set({ state, previousTicket, expires });
    return docRef.id;
  }
}
