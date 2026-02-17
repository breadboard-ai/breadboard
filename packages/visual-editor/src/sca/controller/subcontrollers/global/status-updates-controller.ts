/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { hash } from "@breadboard-ai/utils";
import type { VisualEditorStatusUpdate } from "../../../../ui/types/types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Controller for managing server status updates.
 *
 * Responsibilities:
 * - Stores the list of status updates fetched from the server
 * - Persists the "last seen" hash to localStorage for detecting new updates
 * - Manages the status update chip visibility
 *
 * This replaces the legacy Shell.startTrackUpdates() and
 * RuntimeHostStatusUpdateEvent pattern.
 */
export class StatusUpdatesController extends RootController {
  /**
   * The sorted list of status updates (most recent first).
   */
  @field({ deep: true })
  private accessor _updates: VisualEditorStatusUpdate[] = [];

  /**
   * Hash of the last seen updates, persisted to localStorage.
   * Used to detect if there are "new" updates since the user last viewed.
   */
  @field({ persist: "local" })
  private accessor _lastSeenHash = "0";

  /**
   * Tracks whether the migration from raw localStorage has completed.
   */
  @field({ persist: "local" })
  private accessor _isMigrated = false;

  /**
   * Controls visibility of the status update chip in the header.
   * - `null`: chip has never been shown (initial state)
   * - `true`: chip is visible
   * - `false`: chip has been dismissed
   */
  @field()
  accessor showStatusUpdateChip: boolean | null = null;

  /**
   * Internal cache of the current updates hash for comparison.
   */
  #currentHash = "0";

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
  }

  /**
   * Returns the current list of status updates.
   */
  get updates(): readonly VisualEditorStatusUpdate[] {
    return this._updates;
  }

  /**
   * Returns whether the migration has been completed.
   */
  get isMigrated(): boolean {
    return this._isMigrated;
  }

  /**
   * Returns whether there are new updates that haven't been seen.
   */
  get hasNewUpdates(): boolean {
    return this.#currentHash !== this._lastSeenHash;
  }

  /**
   * Updates the status updates list.
   * Sorts by date (newest first), computes hash, and triggers chip if new.
   *
   * @param values The status updates from the server
   */
  setUpdates(values: VisualEditorStatusUpdate[]): void {
    // Sort by date, newest first
    const sorted = [...values].sort((a, b) => {
      const aDate = new Date(a.date);
      const bDate = new Date(b.date);
      return bDate.getTime() - aDate.getTime();
    });

    // Compute hash from JSON string representation
    const updateHash = hash(JSON.stringify(sorted)).toString();

    // If hash hasn't changed, don't update
    if (updateHash === this.#currentHash) {
      return;
    }

    this.#currentHash = updateHash;
    this._updates = sorted;

    // Show chip if this is new AND first item is not "info" type
    // AND chip has never been shown/dismissed (null state)
    if (
      this.hasNewUpdates &&
      sorted[0]?.type !== "info" &&
      this.showStatusUpdateChip === null
    ) {
      this.showStatusUpdateChip = true;
    }
  }

  /**
   * Marks the current updates as "seen" by storing the current hash.
   * Called when the user views the status updates panel.
   */
  markAsSeen(): void {
    this._lastSeenHash = this.#currentHash;
  }

  /**
   * Migrates an existing hash value from raw localStorage.
   * Called during the migration phase.
   *
   * @param hashValue The hash value from raw localStorage
   */
  migrate(hashValue: string): void {
    if (this._isMigrated) {
      return;
    }

    this._lastSeenHash = hashValue;
    this._isMigrated = true;
  }
}
