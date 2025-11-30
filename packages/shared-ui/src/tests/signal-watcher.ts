/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";

export class SignalWatcher {
  #watcher: Signal.subtle.Watcher;
  #signal: Signal.State<unknown> | Signal.Computed<unknown>;
  #count = 0;

  constructor(signal: Signal.State<unknown> | Signal.Computed<unknown>) {
    this.#signal = signal;
    this.#watcher = new Signal.subtle.Watcher(() => {
      this.#count++;
    });
  }

  get count() {
    return this.#count;
  }

  watch() {
    this.#watcher.watch(this.#signal);
    this.#signal.get();
  }

  reset() {
    this.#count = 0;
  }
}
