/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

interface RecentBoardsDB extends idb.DBSchema {
  boards: {
    key: "recent";
    value: BreadboardUI.Types.RecentBoard[];
  };
}

const RECENT_BOARDS_NAME = "recent-boards";
const RECENT_BOARDS_VERSION = 3;

export class RecentBoardStore {
  static #instance: RecentBoardStore;
  static instance() {
    if (!this.#instance) {
      this.#instance = new RecentBoardStore();
    }
    return this.#instance;
  }

  // Not instantiated directly.
  private constructor() {}

  async store(boards: BreadboardUI.Types.RecentBoard[]) {
    const recentBoardsDb = await idb.openDB<RecentBoardsDB>(
      RECENT_BOARDS_NAME,
      RECENT_BOARDS_VERSION
    );

    recentBoardsDb.put("boards", boards, "recent");
  }

  async restore(): Promise<BreadboardUI.Types.RecentBoard[]> {
    const recentBoardsDb = await idb.openDB<RecentBoardsDB>(
      RECENT_BOARDS_NAME,
      RECENT_BOARDS_VERSION,
      {
        upgrade(db) {
          if (db.objectStoreNames.contains("boards")) return;
          db.createObjectStore("boards");
        },
      }
    );

    const boards = await recentBoardsDb.get("boards", "recent");
    return boards ?? [];
  }
}
