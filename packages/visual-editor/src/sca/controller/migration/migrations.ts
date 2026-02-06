/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecentBoardStore } from "../../../data/recent-boards.js";
import { RecentBoardsController } from "../subcontrollers/home/recent-boards-controller.js";
import { unwrap } from "../decorators/utils/wrap-unwrap.js";
import { RecentBoard } from "../../../ui/types/types.js";
import {
  FlagController,
  StatusUpdatesController,
} from "../subcontrollers/global/global.js";
import { RuntimeFlags } from "@breadboard-ai/types";
import { IdbFlagManager } from "../../../idb/flags/idb-flag-manager.js";

/**
 * localStorage key for status updates hash (legacy storage).
 * Must match the key used in main-base.ts.
 */
const UPDATE_HASH_KEY = "bb-update-hash";

/**
 * Carries the boards over from the old RecentBoardStore to the new
 * RecentBoardController. The migration is tracked in the Controller so that it
 * does not happen multiple times.
 */
export async function recentBoardsMigration(
  boardController: RecentBoardsController
) {
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
}

/**
 * Carries the flags over from the old IdbFlagManager to the new FlagController.
 * The migration is tracked in the Controller so that it does not happen
 * multiple times.
 */
export async function flagsMigration(
  flagController: FlagController,
  runtimeFlags: RuntimeFlags
) {
  // Wait for the flag controller to boot so we can check its migration status.
  await flagController.isHydrated;
  if (flagController.isMigrated) return;

  const flagStore = new IdbFlagManager(runtimeFlags);
  const flags = await flagStore.flags();

  flagController.migrate(flags);
  await flagController.isSettled;
}

/**
 * Carries the status updates hash from raw localStorage to the new
 * StatusUpdatesController. This ensures users don't see the "new updates"
 * chip for updates they've already seen.
 */
export async function statusUpdatesMigration(
  controller: StatusUpdatesController
) {
  // Wait for the controller to boot so we can check its migration status.
  await controller.isHydrated;
  if (controller.isMigrated) return;

  const existingHash = globalThis.localStorage.getItem(UPDATE_HASH_KEY);
  if (existingHash) {
    controller.migrate(existingHash);
    globalThis.localStorage.removeItem(UPDATE_HASH_KEY);
  } else {
    // Mark as migrated even if no hash existed
    controller.migrate("0");
  }

  await controller.isSettled;
}
