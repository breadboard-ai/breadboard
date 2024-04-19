/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdvancedBreadboardType } from "./type.js";

type Enumable = string | number | boolean | null;

/**
 * Creates an enum type for the specified element type.
 *
 * @param values The
 * @returns An `AdvancedBreadboardType` representing an enumeration of the given
 * values.
 */
export function enumeration<T extends [Enumable, ...Enumable[]]>(
  ...values: T
): AdvancedBreadboardType<T[number]> {
  if (values.length === 0) {
    throw new Error("enumeration needs at least one value");
  }
  for (const value of values) {
    const t = typeof value;
    if (t !== "string" && t !== "number" && t !== "boolean" && value !== null) {
      throw new Error(
        `enumeration values must be string, number, boolean, or null. ` +
          `Got ${typeof value}.`
      );
    }
  }
  return {
    jsonSchema: {
      enum: values,
    },
  };
}
