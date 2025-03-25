/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function identity(matrix: DOMMatrix) {
  matrix.m11 = 1;
  matrix.m22 = 1;
  matrix.m33 = 1;
  matrix.m44 = 1;

  matrix.m12 = matrix.m13 = matrix.m14 = 0;
  matrix.m21 = matrix.m23 = matrix.m24 = 0;
  matrix.m31 = matrix.m32 = matrix.m34 = 0;
  matrix.m41 = matrix.m42 = matrix.m43 = 0;
}
