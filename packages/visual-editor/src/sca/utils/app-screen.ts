/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AppScreen,
  AppScreenOutput,
  NodeEndResponse,
  OutputResponse,
  Schema,
} from "@breadboard-ai/types";
import { idFromIndex } from "./common.js";
import { getElasticProgress } from "./elastic-progress.js";

export { createAppScreen, setScreenDuration, tickScreenProgress };
export type { AppScreenData };

/**
 * Extended AppScreen shape with internal bookkeeping for progress computation.
 * This is a POJO — `@field({ deep: true })` in `ScreenController` handles
 * reactivity via deep signal wrapping.
 *
 * IMPORTANT: This object must NOT contain getters, setters, or
 * `Object.defineProperty` accessors. The `wrap()` function in
 * `wrap-unwrap.ts` copies properties via `for...in`, which evaluates
 * getters once and stores static values, losing reactivity.
 * All properties must be plain data values; methods must update them
 * imperatively.
 */
type AppScreenData = AppScreen & {
  /**
   * Timestamp (from `performance.now()`) when `expectedDuration` was last set
   * to a positive value. -1 when no duration is set.
   */
  lastSetDurationTimestamp: number;

  /**
   * Finalizes the screen with final output data and marks it complete.
   */
  finalize(data: NodeEndResponse): void;

  /**
   * Marks this screen as an "input" screen.
   */
  markAsInput(): void;
};

/**
 * Creates a plain-object AppScreen.
 *
 * All properties are plain values (no getters, no classes, no
 * Object.defineProperty). Reactivity is provided by `@field({ deep: true })`
 * in `ScreenController`, which deep-wraps the POJO via `wrap()`.
 *
 * `wrap()` copies property values via `for...in` and wraps them in a
 * `SignalObject`. Getters/accessors would be evaluated once and frozen —
 * so ALL derived state must be computed imperatively and stored as plain
 * data properties.
 *
 * @param title - Display title for the screen
 * @param outputSchema - Optional schema for the final output
 */
function createAppScreen(
  title: string,
  outputSchema: Schema | undefined
): AppScreenData {
  return {
    title,
    status: "processing",
    type: "progress",
    progress: undefined,
    expectedDuration: -1,
    progressCompletion: -1,
    lastSetDurationTimestamp: -1,
    outputs: new Map(),
    last: null,

    addOutput(data: OutputResponse): void {
      const { node, outputs } = data;
      const { configuration = {} } = node;
      const { schema: s = {} } = configuration;

      const entry: AppScreenOutput = {
        schema: s as Schema,
        output: outputs,
      };
      this.outputs.set(idFromIndex(data.index), entry);
      this.last = entry;
    },

    markAsInput(): void {
      this.type = "input";
    },

    finalize(data: NodeEndResponse): void {
      const { outputs } = data;
      const entry: AppScreenOutput = {
        output: outputs,
        schema: outputSchema,
      };
      this.outputs.set(idFromIndex(data.index), entry);
      this.last = entry;
      this.status = "complete";
    },
  };
}

/**
 * Sets the expected duration on an AppScreen and records the timestamp.
 * Since AppScreen properties must be plain data (no setters) for
 * compatibility with `wrap()`, this function handles the side effect
 * of recording when the duration was set.
 *
 * @param screen - The app screen to update
 * @param duration - Duration in seconds, or -1 to clear
 */
function setScreenDuration(screen: AppScreen, duration: number): void {
  screen.expectedDuration = duration;
  const s = screen as AppScreenData;
  if (duration === -1) {
    s.lastSetDurationTimestamp = -1;
    screen.progressCompletion = -1;
  } else {
    s.lastSetDurationTimestamp = performance.now();
    screen.progressCompletion = 0;
  }
}

/**
 * Recomputes `progressCompletion` on an AppScreen from the current time.
 * Call this periodically (e.g. from a `setInterval`) while there are
 * active screens with a positive `expectedDuration`.
 *
 * @param screen - The app screen to tick
 */
function tickScreenProgress(screen: AppScreen): void {
  const s = screen as AppScreenData;
  if (s.lastSetDurationTimestamp === -1) return;

  const fraction =
    (performance.now() - s.lastSetDurationTimestamp) /
    (screen.expectedDuration * 1000);

  screen.progressCompletion = Math.floor(getElasticProgress(fraction) * 100);
}
