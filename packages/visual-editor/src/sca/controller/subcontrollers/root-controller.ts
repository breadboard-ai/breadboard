/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "@lit-labs/signals";
import { pending, HydratedController } from "../../types.js";
import { PENDING_HYDRATION } from "../../utils/sentinel.js";
import { isHydrating } from "../../utils/helpers/helpers.js";
import { reactive } from "../../reactive.js";
import { pendingStorageWrites } from "../context/writes.js";

/**
 * Abstract base class for all SCA controllers.
 *
 * Provides the hydration lifecycle for controllers with persisted `@field` values.
 * When a controller has fields persisted to storage (localStorage, sessionStorage,
 * or IndexedDB), those values must be loaded asynchronously. `RootController` tracks
 * this loading process and exposes promises to await completion.
 *
 * **Hydration Lifecycle:**
 * 1. Controller is instantiated with initial values
 * 2. `@field` decorator registers persisted signals via `registerSignalHydration()`
 * 3. Persisted values load asynchronously from storage
 * 4. `isHydrated` promise resolves when all values are loaded
 *
 * **Key Properties:**
 * - `controllerId`: Unique identifier used for storage key namespacing
 * - `isHydrated`: Promise resolving when all persisted fields are loaded
 * - `isSettled`: Promise resolving when all storage writes complete
 * - `hydrated`: Synchronous boolean check (throws during hydration)
 *
 * @example
 * ```typescript
 * class MyController extends RootController {
 *   @field({ persist: "local" })
 *   accessor userPref = "default";
 *
 *   constructor() {
 *     super("MyController");  // Unique ID for storage
 *   }
 * }
 *
 * // Wait for hydration before accessing persisted fields
 * await myController.isHydrated;
 * console.log(myController.userPref);  // Safe to access
 * ```
 */
export abstract class RootController implements HydratedController {
  #trackedSignals = new Set<Signal.State<unknown>>();
  #isHydratedPromise?: Promise<number>;

  /**
   * We use a persistenceId to namespace the storage keys. This allows us to
   * have multiple instances of the same controller with different controller
   * IDs, but it also makes them resistant to minification of the controller
   * class name via the persistenceId.
   *
   * The storage key format used in field persistence is:
   * `${persistenceId}_${fieldName}_${controllerId}`
   *
   * @param controllerId The ID of the instance.
   * @param persistenceId A consistent ID used when fields in are persisted.
   */
  constructor(
    public readonly controllerId: string,
    public readonly persistenceId: string
  ) { }

  public get hydrated() {
    return !isHydrating(() => this.hydratedInternal.get());
  }

  private readonly hydratedInternal = new Signal.Computed<boolean | pending>(
    () => {
      if (this.#trackedSignals.size === 0) return true;

      for (const sig of this.#trackedSignals) {
        if (isHydrating(() => sig.get())) return PENDING_HYDRATION;
      }

      return true;
    }
  );

  /**
   * Indicates that the controller has fully hydrated.
   */
  get isHydrated(): Promise<number> {
    if (this.#isHydratedPromise) return this.#isHydratedPromise;

    this.#isHydratedPromise = new Promise((resolve) => {
      // Use an effect to watch the computed 'hydrated' signal
      const stop = reactive(() => {
        const status = this.hydratedInternal.get();

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
   * Used by tests particularly to ensure that a value has been persisted. This
   * is populated by the @field decorator indirectly.
   */
  get isSettled(): Promise<void[]> {
    // Storage writes might be enqueued asynchronously, so we need to schedule
    // the settled check for after that. We do so by always resolving on a
    // Promise and then doing a check.
    return Promise.resolve().then(() =>
      Promise.all(pendingStorageWrites.get(this) ?? [])
    );
  }

  /**
   * Called by the @field decorator in the 'init' hook.
   */
  registerSignalHydration(sig: Signal.State<unknown>) {
    this.#trackedSignals.add(sig);
  }
}
