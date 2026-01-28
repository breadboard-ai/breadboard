/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EditHistoryEntry } from "@breadboard-ai/types";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Controller for board-level state that persists across sessions.
 *
 * Manages:
 * - Shared version history (to detect newer versions of shared graphs)
 * - Edit history (undo/redo state per board URL)
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
  private accessor sharedVersionHistory: Map<string, number> = new Map();

  /**
   * Tracks edit history (undo/redo stack) for each board URL.
   * Persisted to IDB so users can undo/redo across sessions. This is not a deep
   * field because the consumed history needs to be passed to structuredClone
   * which cannot handle Proxies.
   *
   * @deep false
   *
   * Key: Board URL
   * Value: Array of edit history entries
   */
  @field({ persist: "idb", deep: false })
  private accessor editHistory: Map<string, EditHistoryEntry[]> = new Map();

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

  /**
   * Gets the edit history for a board URL.
   *
   * @param url The board URL
   * @returns The edit history entries, or empty array if none
   */
  getEditHistory(url: string): EditHistoryEntry[] {
    return this.editHistory.get(url) ?? [];
  }

  /**
   * Saves the edit history for a board URL.
   * This is automatically persisted to IndexedDB via the @field decorator.
   *
   * @param url The board URL
   * @param history The edit history entries to save
   */
  saveEditHistory(url: string, history: Readonly<EditHistoryEntry[]>): void {
    this.editHistory.set(url, [...history]);
  }
}
