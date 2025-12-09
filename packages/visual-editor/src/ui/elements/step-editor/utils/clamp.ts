/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function clamp(value: number, min: number, max: number) {
  if (value > max) return max;
  if (value < min) return min;
  return value;
}
