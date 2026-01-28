/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BoardServer } from "@breadboard-ai/types";
import type { BoardController } from "../../../controller/subcontrollers/board/board-controller.js";

export type { VersionInfo, CheckVersionDeps };

/**
 * Version information for a shared graph.
 */
interface VersionInfo {
  /** The current version from the board server */
  version: number;
  /** The version last seen by this user */
  lastLoadedVersion: number;
  /** True if there's a newer version available */
  isNewer: boolean;
}

/**
 * Dependencies for version checking.
 */
interface CheckVersionDeps {
  /** Function to check if the graph belongs to the current user */
  isMine: (url: string | undefined) => boolean;
}

/**
 * Checks the version of a shared graph and determines if it's newer.
 *
 * Only checks version for graphs that:
 * - Are not owned by the current user
 * - Have a URL
 * - Are associated with a board server that supports version checking
 *
 * Uses the BoardController's IDB-persisted sharedVersionHistory to track
 * previously seen versions.
 *
 * @param graphUrl The URL of the graph
 * @param boardServer The board server the graph came from
 * @param boardController The board controller for version history
 * @param deps Dependencies (isMine function)
 * @returns Version information, or null if version checking is not applicable
 */
export async function checkVersion(
  graphUrl: string | undefined,
  boardServer: BoardServer | null,
  boardController: BoardController,
  deps: CheckVersionDeps
): Promise<VersionInfo | null> {
  // Don't check version for graphs we own
  if (deps.isMine(graphUrl)) {
    return null;
  }

  // Need a URL and board server with version support
  if (!graphUrl || !boardServer?.getLatestSharedVersion) {
    return null;
  }

  // Ensure version history is hydrated from IDB before reading
  await boardController.isHydrated;

  // Get the last seen version from the controller (IDB-backed)
  const lastLoadedVersion = boardController.getLastSeenVersion(graphUrl);

  // Get current version from board server
  const version = boardServer.getLatestSharedVersion(new URL(graphUrl));

  // Record the current version (automatically persisted to IDB via @field)
  boardController.recordVersion(graphUrl, version);

  const isNewer = lastLoadedVersion !== -1 && lastLoadedVersion < version;

  return {
    version,
    lastLoadedVersion,
    isNewer,
  };
}
