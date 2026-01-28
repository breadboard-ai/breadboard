/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Controller for board-level state that persists across sessions.
 *
 * Manages:
 * - Shared version history (to detect newer versions of shared graphs)
 * - Board loading state
 */
export class BoardController extends RootController {
  /**
   * Tracks the last-seen version for each shared graph URL.
   * Used to detect when a shared graph has been updated since last viewed.
   *
   * Key: Graph URL
   * Value: Version number from board server
   */
  @field({ persist: "idb" })
  accessor sharedVersionHistory: Map<string, number> = new Map();

  /**
   * Whether there's a newer version of the current shared graph available.
   * Set by the load action, consumed by a trigger that shows a snackbar.
   */
  @field()
  accessor newerVersionAvailable = false;

  constructor(id: string) {
    super(id);
  }

  /**
   * Gets the last-seen version for a shared graph URL.
   *
   * @param url The graph URL
   * @returns The last seen version, or -1 if never seen
   */
  getLastSeenVersion(url: string): number {
    return this.sharedVersionHistory.get(url) ?? -1;
  }

  /**
   * Records the current version for a shared graph URL.
   * This is automatically persisted to IndexedDB via the @field decorator.
   *
   * @param url The graph URL
   * @param version The current version
   */
  recordVersion(url: string, version: number): void {
    this.sharedVersionHistory.set(url, version);
  }
}
