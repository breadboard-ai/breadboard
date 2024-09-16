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
  if (allTypesAreBasic) {
    return {
      jsonSchema: {
        type: types.map((member) => member.type as JSONSchema4TypeName),
      },
    };
  }
  const uniqueCoreTypes = new Set(types.map(({ type }) => type));
  if (uniqueCoreTypes.size === 1) {
    // TODO(aomarks) Remove this when we no longer have this limitation.
    // This is a no-op according to JSON Schema, but it's helpful in Breadboard
    // right now because we have some code that assumes there is always a
    // top-level core "type", and doesn't understand "anyOf". In the case where
    // all the "anyOf" core types are the same, we can hoist it up to make that
    // code happy.
    return {
      jsonSchema: {
        type: [...uniqueCoreTypes][0],
        anyOf: types,
      },
    };
  }
  return {
    jsonSchema: { anyOf: types },
  };
}
