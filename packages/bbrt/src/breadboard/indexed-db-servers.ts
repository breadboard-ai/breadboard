/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import { BreadboardServer } from "./breadboard-server.js";

type BoardServerEntry = { url: string };

export async function readBoardServersFromIndexedDB(): Promise<
  Result<BreadboardServer[]>
> {
  const db = await resultify(indexedDB.open("board-server"));
  if (!db.ok) {
    return db;
  }
  const store = resultify(() => {
    const transaction = db.value.transaction(["servers"]);
    return transaction.objectStore("servers");
  });
  if (!store.ok) {
    if ((store.error as { name?: unknown }).name === "NotFoundError") {
      return { ok: true, value: [] };
    }
    return store;
  }
  const entries = await resultify(
    store.value.getAll() as IDBRequest<BoardServerEntry[]>
  );
  if (!entries.ok) {
    return entries;
  }
  return {
    ok: true,
    value: entries.value
      .map(({ url }) => url)
      .filter((url) => url.startsWith("http") || url.startsWith("https"))
      .map((url) => new BreadboardServer(url)),
  };
}
