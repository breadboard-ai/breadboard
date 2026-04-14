/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "@lit-labs/signals";

/**
 * A simple, signal-backed store for feature flags.
 * Reduced to the bare minimum without persistence.
 */
export class EnvironmentFlags {
  #signals = new Map<string, Signal.State<boolean>>();

  constructor(defaults: Record<string, boolean> = {}) {
    for (const [key, value] of Object.entries(defaults)) {
      this.#signals.set(key, new Signal.State(value));
    }
  }

  /** Read a flag (reactive). */
  get(key: string): boolean {
    const sig = this.#signals.get(key);
    if (!sig) {
      return false;
    }
    return sig.get();
  }

  /** Set a flag. */
  set(key: string, value: boolean) {
    const sig = this.#signals.get(key);
    if (sig) {
      sig.set(value);
    } else {
      this.#signals.set(key, new Signal.State(value));
    }
  }

  /** Resolves immediately as there is no persistence to hydrate. */
  get isHydrated(): Promise<number> {
    return Promise.resolve(0);
  }
}
