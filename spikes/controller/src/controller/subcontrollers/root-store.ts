/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "@lit-labs/signals";
import { HydratedStore } from "../types";
import { pending, PENDING_HYDRATION } from "../utils/sentinel.js";
import { isHydrating } from "../utils/hydration.js";
import { effect } from "signal-utils/subtle/microtask-effect";

export class RootStore implements HydratedStore {
  #trackedSignals = new Set<Signal.State<unknown>>();

  public readonly hydrated = new Signal.Computed<boolean | pending>(() => {
    if (this.#trackedSignals.size === 0) return true;

    for (const sig of this.#trackedSignals) {
      if (isHydrating(sig.get())) return PENDING_HYDRATION;
    }

    return true;
  });

  public readonly isHydrated: Promise<number>;

  constructor() {
    this.isHydrated = new Promise((resolve) => {
      const stop = effect(() => {
        const status = this.hydrated.get();
        if (status === true) {
          queueMicrotask(() => stop()); // Disconnect effect
          resolve(Date.now());
        }
      });
    });
  }

  /**
   * Called by the @field decorator in the 'init' hook.
   */
  registerSignalHydration(sig: Signal.State<unknown>) {
    this.#trackedSignals.add(sig);
  }
}
