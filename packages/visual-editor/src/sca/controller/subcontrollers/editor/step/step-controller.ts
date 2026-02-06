/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import { PendingEdit, PendingAssetEdit } from "../../../../types.js";

export { StepController };

/**
 * Controller for step editing state.
 *
 * Tracks pending edits that haven't been saved to the graph yet.
 * Works with the step autosave trigger to save edits when
 * selection or sidebar changes.
 */
class StepController extends RootController {
  /**
   * The current pending edit (transformed values, ready to apply).
   * Set by entity-editor when form values change.
   * Note: No deep: true - we replace the whole object, and deep proxies
   * can't be structuredClone'd (causes DataCloneError in history).
   */
  @field({ deep: false })
  private accessor _pendingEdit: PendingEdit | null = null;

  /**
   * The current pending asset edit.
   * Set by entity-editor when asset form values change.
   */
  @field({ deep: false })
  private accessor _pendingAssetEdit: PendingAssetEdit | null = null;

  get pendingEdit(): PendingEdit | null {
    return this._pendingEdit;
  }

  get pendingAssetEdit(): PendingAssetEdit | null {
    return this._pendingAssetEdit;
  }

  /**
   * Set the pending edit. Called by entity-editor when form values change.
   */
  setPendingEdit(edit: PendingEdit): void {
    this._pendingEdit = edit;
  }

  /**
   * Set the pending asset edit. Called by entity-editor when asset form changes.
   */
  setPendingAssetEdit(edit: PendingAssetEdit): void {
    this._pendingAssetEdit = edit;
  }

  /**
   * Clear the pending edit. Called before applying configuration
   * to avoid re-triggering if apply fails.
   */
  clearPendingEdit(): void {
    this._pendingEdit = null;
  }

  /**
   * Clear the pending asset edit.
   */
  clearPendingAssetEdit(): void {
    this._pendingAssetEdit = null;
  }
}
