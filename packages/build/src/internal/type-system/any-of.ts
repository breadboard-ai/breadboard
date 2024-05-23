/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4TypeName } from "json-schema";
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
  const types = members.map(toJSONSchema);
  const allTypesAreBasic = types.every(
    (member) =>
      typeof member.type === "string" && Object.keys(member).length === 1
  );
  return {
    jsonSchema: allTypesAreBasic
      ? { type: types.map((member) => member.type as JSONSchema4TypeName) }
      : { anyOf: types },
  };
}
