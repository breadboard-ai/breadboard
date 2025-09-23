/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { filterEmptyValues, filterUndefined };

/**
 * A utility function to filter out empty (null or undefined) values from
 * an object.
 *
 * @param obj -- The object to filter.
 * @returns -- The object with empty values removed.
 */
function filterEmptyValues<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (!value) return false;
      if (typeof value === "object") {
        return Object.keys(value).length > 0;
      }
      return true;
    })
  ) as T;
}

function filterUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (!value) return false;
      return true;
    })
  ) as T;
}
