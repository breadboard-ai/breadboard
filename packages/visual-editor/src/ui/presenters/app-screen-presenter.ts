/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { reactive } from "../../sca/reactive.js";
import type { AppScreen, OutputValues } from "@breadboard-ai/types";
import type { SCA } from "../../sca/sca.js";
import type { AppScreenData } from "../../sca/utils/app-screen.js";

/**
 * The high-level UI state of the app panel during a run.
 */
type AppState =
  | "splash"
  | "error"
  | "input"
  | "progress"
  | "interactive"
  | "output";

export { AppScreenPresenter, type AppState };

/**
 * AppScreenPresenter - UI-layer presenter that derives app-level screen state.
 *
 * This presenter replaces `ReactiveApp` by computing derived state from:
 * - `RunController` (status, error, input)
 * - `ScreenController` (screens map)
 *
 * It watches these sources via an effect and updates reactive signals
 * that UI components can consume for rendering.
 *
 * ## Derived Properties
 *
 * - `state` — Overall app UI state: splash/error/input/progress/interactive/output
 * - `current` — Map of currently active (incomplete) screens
 * - `last` — The most recent non-input-complete screen, or null
 * - `finalOutput` — The output values when in "output" state, or null
 *
 * ## Lifecycle
 *
 * The host element should:
 * 1. Call `connect(sca)` in connectedCallback
 * 2. Call `disconnect()` in disconnectedCallback
 */
class AppScreenPresenter {
  @signal
  accessor state: AppState = "splash";

  @signal
  accessor current: ReadonlyMap<string, AppScreen> = new Map();

  @signal
  accessor last: AppScreenData | null = null;

  #disposeEffect: (() => void) | null = null;
  #sca: SCA | null = null;

  /**
   * Connects the presenter to SCA and starts the effect.
   * Call this in the host element's connectedCallback.
   */
  connect(sca: SCA): void {
    if (this.#disposeEffect) {
      return;
    }

    this.#sca = sca;

    this.#disposeEffect = reactive(() => {
      this.#update();
    });
  }

  /**
   * Disconnects the presenter and stops the effect.
   * Call this in the host element's disconnectedCallback.
   */
  disconnect(): void {
    if (this.#disposeEffect) {
      this.#disposeEffect();
      this.#disposeEffect = null;
    }
    this.#sca = null;
    this.state = "splash";
    this.current = new Map();
    this.last = null;
  }

  /**
   * Recomputes all derived state from controllers.
   *
   * State derivation mirrors `ReactiveApp.state`:
   * 1. No `last` screen → "splash"
   * 2. Fatal error → "error"
   * 3. Input pending → "input"
   * 4. No active (current) screens → "output"
   * 5. Any screen interactive with a2ui → "interactive"
   * 6. Otherwise → "progress"
   */
  #update(): void {
    if (!this.#sca) return;

    const { controller } = this.#sca;
    const runController = controller.run.main;
    const screenController = controller.run.screen;
    const screens = screenController.screens;

    // Derive `last` — latest screen that isn't an input-complete screen
    this.last =
      Array.from(screens.values()).findLast(
        (screen) => !(screen.type === "input" && screen.status === "complete")
      ) || null;

    // Derive `current` — active (incomplete) screens
    this.current = new Map(
      Array.from(screens.entries())
        .map(([id, screen]) =>
          screen.status !== "complete" ? [id, screen] : null
        )
        .filter(Boolean) as [string, AppScreen][]
    );

    // Derive `state`
    if (!this.last) {
      // Pre-loaded results from a shared link populate finalOutputValues
      // on the GraphController without creating any run screens.
      this.state = controller.editor.graph.finalOutputValues
        ? "output"
        : "splash";
    } else if (runController.error) {
      this.state = "error";
    } else if (runController.input) {
      this.state = "input";
    } else if (this.current.size === 0) {
      this.state = "output";
    } else if (
      [...screens.values()].some(
        (screen) => screen.last?.a2ui && screen.status === "interactive"
      )
    ) {
      this.state = "interactive";
    } else {
      this.state = "progress";
    }
  }

  /**
   * Returns the final output values when in the "output" state.
   *
   * Sources (in priority order):
   * 1. The last completed screen's output (normal run completion).
   *    JSON round-tripped to strip signal proxies that can't be structuredClone'd.
   * 2. Pre-loaded `finalOutputValues` from a shared results link.
   */
  get finalOutput(): OutputValues | null {
    const screenOutput = this.last?.last?.output;
    if (screenOutput) {
      return JSON.parse(JSON.stringify(screenOutput));
    }
    return this.#sca?.controller.editor.graph.finalOutputValues || null;
  }
}
