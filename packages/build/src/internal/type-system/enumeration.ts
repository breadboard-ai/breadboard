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
  const types = new Set<"string" | "number" | "boolean" | "null">(
    values.map((value) => {
      const t = typeof value;
      switch (t) {
        case "string":
        case "number":
        case "boolean":
          return t;
      }
      if (value === null) {
        return "null";
      }
      throw new Error(
        `enumeration values must be string, number, boolean, or null. ` +
          `Got ${t}.`
      );
    })
  );
  if (types.size === 1) {
    return {
      jsonSchema: {
        type: [...types][0]!,
        enum: values,
      },
    };
  }
  return {
    jsonSchema: {
      enum: values,
    },
  };
}
