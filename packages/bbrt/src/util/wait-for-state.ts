/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";

export function waitForState<T>(
  signal: Signal.State<T>,
  predicate: (state: T) => boolean
): Promise<T> {
  return new Promise((resolve) => {
    const watcher = new Signal.subtle.Watcher(() => {
      // TODO(aomarks) This works, but I'm not certain it's the best approach.
      queueMicrotask(() => {
        const value = signal.get();
        if (predicate(value)) {
          resolve(value);
          watcher.unwatch(signal);
        } else {
          watcher.watch();
        }
      });
    });
    watcher.watch(signal);
  });
}
