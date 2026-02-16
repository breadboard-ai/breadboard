/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeIdentifier } from "@breadboard-ai/types";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";
import type { AppScreenData } from "../../../utils/app-screen.js";

export { ScreenController };

/**
 * Controller for per-node app screen state during a run.
 *
 * A "screen" represents the visual output panel for a node (showing
 * progress, input requests, or final output). This controller owns
 * the map of screen instances, while the {@link AppScreenPresenter}
 * derives higher-level UI state (appState, current, last) from this
 * map and RunController.
 *
 * Updated by Actions in response to runner events (`nodestart` creates
 * a screen, `nodeend` finalizes or deletes screens, `output` adds data).
 *
 * Each screen is an `AppScreenData` POJO owning its own
 * outputs, status, and type.
 *
 * The underlying Map is a `DeepSignalMap` (produced by `wrap()` in the
 * `@field({ deep: true })` decorator) which automatically deep-wraps
 * values on `set()`. This means all property mutations on screens are
 * tracked by the reactivity system, regardless of whether callers use
 * in-place mutations or wholesale replacement.
 */
class ScreenController extends RootController {
  /**
   * Map of node ID → screen state.
   */
  @field({ deep: true })
  private accessor _screens: Map<NodeIdentifier, AppScreenData> = new Map();

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the screens map.
   */
  get screens(): Map<NodeIdentifier, AppScreenData> {
    return this._screens;
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sets (creates or replaces) a screen for a node.
   *
   * @param id The node identifier
   * @param screen The screen instance
   */
  setScreen(id: NodeIdentifier, screen: AppScreenData): void {
    this._screens.set(id, screen);
  }

  /**
   * Deletes a screen for a node.
   *
   * @param id The node identifier
   * @returns true if the screen existed and was deleted
   */
  deleteScreen(id: NodeIdentifier): boolean {
    return this._screens.delete(id);
  }

  /**
   * Bumps a screen to the end of the map ordering.
   * Used when a screen transitions to input mode to ensure
   * it appears as the "latest" screen.
   *
   * @param id The node identifier
   */
  bumpScreen(id: NodeIdentifier): void {
    const screen = this._screens.get(id);
    if (!screen) return;
    this._screens.delete(id);
    this._screens.set(id, screen);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resets all screen state for a new run.
   */
  reset(): void {
    this._screens.clear();
  }
}
