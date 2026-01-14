/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "@lit-labs/signals";
import { HydratedController } from "../types.js";
import { pending, PENDING_HYDRATION } from "../utils/sentinel.js";
import { isHydrating } from "../utils/hydration.js";
import { effect } from "signal-utils/subtle/microtask-effect";
import { getLogger } from "../utils/logging/logger.js";
import * as Formatter from "../utils/logging/formatter.js";
import { pendingStorageWrites } from "../context/writes.js";

export class RootController implements HydratedController {
  #trackedSignals = new Set<Signal.State<unknown>>();
  #logger = getLogger();
  #isHydratedPromise?: Promise<number>;
  readonly log = this.#logger.log.bind(this.#logger);
  readonly formatter = Formatter;

  public readonly hydrated = new Signal.Computed<boolean | pending>(() => {
    if (this.#trackedSignals.size === 0) return true;

    for (const sig of this.#trackedSignals) {
      if (isHydrating(sig.get())) return PENDING_HYDRATION;
    }

    return true;
  });

  /**
   * We use a getter so that the promise is only created when
   * someone actually wants to wait for it.
   */
  get isHydrated(): Promise<number> {
    if (this.#isHydratedPromise) return this.#isHydratedPromise;

    this.#isHydratedPromise = new Promise((resolve) => {
      // Use an effect to watch the computed 'hydrated' signal
      const stop = effect(() => {
        const status = this.hydrated.get();

        if (status === true) {
          // We wrap this in a microtask to ensure all 'init'
          // hooks across the inheritance chain have finished.
          queueMicrotask(() => {
            stop();
            resolve(Date.now());
          });
        }
      });
    });

    return this.#isHydratedPromise;
  }

  /**
   * Called by the @field decorator in the 'init' hook.
   */
  registerSignalHydration(sig: Signal.State<unknown>) {
    this.#trackedSignals.add(sig);
  }

  /**
   * Used by tests particularly to ensure that a value has been persisted. This
   * is populated by the @field decorator indirectly.
   */
  async pendingWritesSettled() {
    return Promise.all(pendingStorageWrites.get(this) ?? []);
  }
}
