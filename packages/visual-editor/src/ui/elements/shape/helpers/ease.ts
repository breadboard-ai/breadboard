/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Ease = typeof easeIn | typeof easeOut | typeof easeInOut;

export function easeIn(v: number, p = 3) {
  if (v <= 0) return v;
  if (v >= 1) return v;
  return v ** p;
}

export function easeOut(v: number, p = 3) {
  if (v <= 0) return v;
  if (v >= 1) return v;
  return 1 - (1 - v) ** p;
}

export function easeInOut(v: number, p = 3) {
  if (v <= 0) return v;
  if (v >= 1) return v;
  if (v <= 0.5) return easeIn(v * 2, p) * 0.5;
  return 0.5 + easeOut((v - 0.5) * 2, p) * 0.5;
}
