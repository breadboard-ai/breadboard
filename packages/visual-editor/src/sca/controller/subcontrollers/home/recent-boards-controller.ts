/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecentBoard } from "../../../../ui/types/types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

const MAX_RECENT_BOARDS_SIZE = 100;

export class RecentBoardsController extends RootController {
  @field({ persist: "idb", deep: true })
  private accessor _boards: RecentBoard[] = [];

  @field({ persist: "local" })
  private accessor _migrated = false;

  constructor(
    controllerId: string,
    persistenceId: string,
    private readonly maxSize = MAX_RECENT_BOARDS_SIZE
  ) {
    super(controllerId, persistenceId);
  }

  /**
   * Here for migrating from the old storage layer.
   * @deprecated
   */
  get isMigrated() {
    return this._migrated;
  }

  /**
   * Here for migrating from the old storage layer.
   * @deprecated
   */
  async migrate(boards: RecentBoard[]) {
    await this.isHydrated;
    if (this._migrated) return;

    // We work backwards through any boards to ensure that recency is preserved.
    for (let i = boards.length - 1; i >= 0; i--) {
      this.add(boards[i]);
    }
    this._migrated = true;
  }

  get boards(): ReadonlyArray<RecentBoard> {
    return this._boards;
  }

  #find(url: string) {
    return this._boards.findIndex((b) => b.url === url);
  }

  add(board: RecentBoard) {
    const index = this.#find(board.url);
    if (index !== -1) {
      const [existing] = this._boards.splice(index, 1);
      if (board.title) {
        existing.title = board.title;
      }

      board = existing;
    }

    this._boards.unshift(board);

    if (this._boards.length <= this.maxSize) return;
    this._boards.length = this.maxSize;
  }

  remove(url: string) {
    const index = this.#find(url);
    if (index === -1) return;

    this._boards.splice(index, 1);
  }

  setPin(url: string, pinned: boolean) {
    const index = this.#find(url);
    if (index === -1) {
      this.add({
        url,
        title: "",
        pinned,
      });
      return;
    }

    this._boards[index].pinned = pinned;
  }
}
