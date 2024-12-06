/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Signal } from "signal-polyfill";
import { effect } from "signal-utils/subtle/microtask-effect";

export function waitForState<T>(
  signal: Signal.State<T>,
  predicate: (state: T) => boolean
): Promise<T> {
  return new Promise((resolve) => {
    const unwatch = effect(() => {
      const value = signal.get();
      if (predicate(value)) {
        resolve(value);
        unwatch();
      }
    });
  });
}
