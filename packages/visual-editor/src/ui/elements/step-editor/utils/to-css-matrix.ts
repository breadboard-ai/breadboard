/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function toCSSMatrix(m: DOMMatrix, force2D = false): string {
  if (force2D) {
    return `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
  }

  return `matrix3d(${m.m11}, ${m.m12}, ${m.m13}, ${m.m14},
      ${m.m21}, ${m.m22}, ${m.m23}, ${m.m24},
      ${m.m31}, ${m.m32}, ${m.m33}, ${m.m34},
      ${m.m41}, ${m.m42}, ${m.m43}, ${m.m44})`;
}
