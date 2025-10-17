/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { SignalArray } from "signal-utils/array";
import { SignalObject } from "signal-utils/object";
import { RecentBoard } from "@breadboard-ai/shared-ui/types/types.js";

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

    // Flatten the SignalArray back down so that it can be stored in IDB.
    const storeBoards = [];
    for (const board of boards) {
      storeBoards.push({
        title: board.title,
        url: board.url,
        pinned: board.pinned ?? false,
      });
    }
    recentBoardsDb.put("boards", storeBoards, "recent");
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
    const signalBoards = new SignalArray<RecentBoard>();
    if (!boards) {
      return signalBoards;
    }

    for (const board of boards) {
      signalBoards.push(
        new SignalObject({
          url: board.url,
          title: board.title,
          pinned: board.pinned ?? false,
        })
      );
    }
    return signalBoards;
  }
}
