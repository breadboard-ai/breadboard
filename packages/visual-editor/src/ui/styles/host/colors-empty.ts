/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * When the graph is empty we render with no colorization. This is a set of
 * overrides.
 */
export const emptyStyles: Record<string, string> = {
  "--s-90": "light-dark(var(--n-100), var(--n-15))",
  "--s-95": "light-dark(var(--n-95), var(--n-15))",
  "--s-80": "light-dark(var(--n-90), var(--n-15))",
  "--s-70": "light-dark(var(--n-90), var(--n-15))",
  "--p-80": "light-dark(var(--n-80), var(--n-20))",
  "--p-50": "light-dark(var(--n-50), var(--n-30))",
  "--p-30": "light-dark(var(--n-30), var(--n-15))",
  "--p-15": "light-dark(var(--n-15), var(--n-90))",
};
