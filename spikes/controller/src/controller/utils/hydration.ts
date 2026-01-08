/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PENDING_HYDRATION } from "./sentinel.js";

/**
 * Checks if a property decorated with @api is still loading from storage.
 */
export function isHydrating<T>(
  value: T | typeof PENDING_HYDRATION
): value is typeof PENDING_HYDRATION {
  return value === PENDING_HYDRATION;
}
