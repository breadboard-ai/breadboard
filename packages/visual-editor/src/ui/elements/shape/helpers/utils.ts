/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function clamp(v: number, min = 0, max = 1) {
  if (v <= min) return min;
  if (v >= max) return max;
  return v;
}

export function runWhenIdle(callback: IdleRequestCallback) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback);
    return;
  }

  setTimeout(callback, 1);
}
