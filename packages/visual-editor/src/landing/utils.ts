/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function shortestPath(
  num1: number,
  num2: number,
  windowSize: number
): number {
  // 1. Calculate the initial direct difference.
  let difference = num2 - num1;
  // 2. Normalize the difference so it's within the range
  //    [-(windowSize-1), windowSize-1].
  difference = ((difference % windowSize) + windowSize) % windowSize;
  // 3. Find the shortest path.
  if (difference > windowSize / 2) {
    return difference - windowSize;
  }

  return difference;
}

export function toCSSMatrix(m: DOMMatrix, force2D = true): string {
  if (force2D) {
    return `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
  }

  return `matrix3d(${m.m11}, ${m.m12}, ${m.m13}, ${m.m14},
      ${m.m21}, ${m.m22}, ${m.m23}, ${m.m24},
      ${m.m31}, ${m.m32}, ${m.m33}, ${m.m34},
      ${m.m41}, ${m.m42}, ${m.m43}, ${m.m44})`;
}
