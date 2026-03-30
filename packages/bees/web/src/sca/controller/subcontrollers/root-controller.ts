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
import { pendingStorageWrites } from "../../context/writes.js";

export abstract class RootController implements HydratedController {
  #trackedSignals = new Set<Signal.State<unknown>>();
  #isHydratedPromise?: Promise<number>;

  constructor(
    public readonly controllerId: string,
    public readonly persistenceId: string
  ) {}

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

  get isHydrated(): Promise<number> {
    if (this.#isHydratedPromise) return this.#isHydratedPromise;

    this.#isHydratedPromise = new Promise((resolve) => {
      const stop = reactive(() => {
        const status = this.hydratedInternal.get();

        if (status === true) {
          queueMicrotask(() => {
            stop();
            resolve(Date.now());
          });
        }
      });
    });

    return this.#isHydratedPromise;
  }

  get isSettled(): Promise<void[]> {
    return Promise.resolve().then(
      () => Promise.all(pendingStorageWrites.get(this) ?? []) as Promise<void[]>
    );
  }

  registerSignalHydration(sig: Signal.State<unknown>) {
    this.#trackedSignals.add(sig);
  }
}
