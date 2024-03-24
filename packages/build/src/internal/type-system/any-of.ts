/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  toJSONSchema,
  type BreadboardType,
  type AdvancedBreadboardType,
  type ConvertBreadboardType,
} from "./type.js";

/**
 * Make a Breadboard type that can have any of the given `members`. Equivalent
 * to JSON Schema's `anyOf`, and TypeScript's union operator (`|`).
 *
 * @param members The types which are allowed to match.
 */
export function anyOf<
  T extends [BreadboardType, BreadboardType, ...BreadboardType[]],
>(...members: T): AdvancedBreadboardType<ConvertBreadboardType<T[number]>> {
  return {
    jsonSchema: {
      anyOf: members.map(toJSONSchema),
    },
  };
}
