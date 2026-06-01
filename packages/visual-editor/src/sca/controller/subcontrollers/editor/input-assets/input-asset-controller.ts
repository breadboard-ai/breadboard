/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export { InputAssetController };

/**
 * Manages the ephemeral collection of assets attached to an input before
 * submission. This is the "scratch pad" of files, images, YouTube links,
 * etc. that a user accumulates while composing a message.
 *
 * The controller is consumed by both the Opie chat panel and (eventually)
 * the run-view floating input. State lives here, not in the UI component.
 *
 * **Lifecycle:**
 * 1. User adds assets via the add-asset flow → `add()`
 * 2. User removes individual assets → `remove()`
 * 3. On submit, the consumer drains all assets → `drain()`
 *    which returns the current collection and clears the shelf.
 */
class InputAssetController extends RootController {
  @field({ deep: false })
  private accessor _assets: LLMContent[] = [];

  /**
   * The current pending assets. Read-only view for UI rendering.
   */
  get assets(): readonly LLMContent[] {
    return this._assets;
  }

  /**
   * Whether the shelf has any assets.
   */
  get populated(): boolean {
    return this._assets.length > 0;
  }

  /**
   * Add an asset to the pending collection.
   */
  add(asset: LLMContent): void {
    this._assets = [...this._assets, asset];
  }

  /**
   * Remove a specific asset by reference identity.
   */
  remove(asset: LLMContent): void {
    this._assets = this._assets.filter((a) => a !== asset);
  }

  /**
   * Return all pending assets and clear the shelf.
   * Used at submit time to merge assets into the outgoing message.
   */
  drain(): LLMContent[] {
    const drained = [...this._assets];
    this._assets = [];
    return drained;
  }

  /**
   * Clear all pending assets without returning them.
   */
  clear(): void {
    this._assets = [];
  }
}
