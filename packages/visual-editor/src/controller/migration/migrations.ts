/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecentBoardStore } from "../../data/recent-boards.js";
import { RecentBoardsController } from "../subcontrollers/home/recent-boards-controller.js";
import { unwrap } from "../decorators/utils/wrap-unwrap.js";
import { RecentBoard } from "../../ui/types/types.js";

/**
 * Carries the boards over from the old RecentBoardStore to the new
 * RecentBoardController. The migration is tracked in the Controller so that it
 * does not happen multiple times.
 *
 * TODO: Remove the old board store.
 */
export const recentBoardsMigration = async (
  boardController: RecentBoardsController
) => {
  // Wait for the board controller to boot so we can check its migration status.
  await boardController.isHydrated;
  if (boardController.isMigrated) return;

  const boardStore = RecentBoardStore.__instance();

  // If we get here we are in an unmigrated state so grab the boards, and move
  // them over.
  await boardStore.restore();
  const boards = unwrap(boardStore.boards) as RecentBoard[];
  if (boardController.boards.length > 0 && boards.length === 0) return;
  boardController.migrate(boards);

  // Remove the boards from the old store.
  await boardStore.clear();
  await boardController.isSettled;
};
