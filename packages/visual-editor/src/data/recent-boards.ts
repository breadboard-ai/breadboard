/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import * as BreadboardUI from "../ui/index.js";
import { SignalArray } from "signal-utils/array";
import { SignalObject } from "signal-utils/object";
import { RecentBoard } from "../ui/types/types.js";

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

  readonly boards = new SignalArray<RecentBoard>();

  // Not instantiated directly.
  private constructor() {}

  async add(board: RecentBoard) {
    const index = this.boards.findIndex((b) => b.url === board.url);
    if (index !== -1) {
      const [existing] = this.boards.splice(index, 1);
      if (board.title) {
        existing.title = board.title;
      }
      this.boards.unshift(existing);
    } else {
      this.boards.unshift(board);
    }

    if (this.boards.length > 50) {
      this.boards.length = 50;
    }

    await this.#store();
  }

  async remove(url: string) {
    const index = this.boards.findIndex((b) => b.url === url);
    if (index !== -1) {
      this.boards.splice(index, 1);
      await this.#store();
    }
  }

  async setPin(url: string, pinned: boolean) {
    const board = this.boards.find((b) => b.url === url);
    if (board) {
      board.pinned = pinned;
      await this.#store();
    }
  }

  async #store() {
    const recentBoardsDb = await idb.openDB<RecentBoardsDB>(
      RECENT_BOARDS_NAME,
      RECENT_BOARDS_VERSION
    );

    // Flatten the SignalArray back down so that it can be stored in IDB.
    const storeBoards = [];
    for (const board of this.boards) {
      storeBoards.push({
        title: board.title,
        url: board.url,
        pinned: board.pinned ?? false,
      });
    }
    recentBoardsDb.put("boards", storeBoards, "recent");
  }

  async restore(): Promise<void> {
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
    if (!boards) {
      return;
    }

    for (const board of boards) {
      this.boards.push(
        new SignalObject({
          url: board.url,
          title: board.title,
          pinned: board.pinned ?? false,
        })
      );
    }
  }
}
