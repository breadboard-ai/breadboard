/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  toJSONSchema,
  type AdvancedBreadboardType,
  type BreadboardType,
  type ConvertBreadboardType,
} from "./type.js";

/**
 * Creates an array type for the specified element type.
 *
 * @param elementType - The type of elements in the array.
 * @returns An `AdvancedBreadboardType` representing an array of the specified element type.
 */
export function array<T extends BreadboardType>(
  elementType: T
): AdvancedBreadboardType<ConvertBreadboardType<T>[]> {
  return {
    jsonSchema: {
      type: "array",
      items: toJSONSchema(elementType),
    },
  };
}
