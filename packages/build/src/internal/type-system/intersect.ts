/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type JSONSchema4 } from "json-schema";
import {
  toJSONSchema,
  type AdvancedBreadboardType,
  type BreadboardType,
  type ConvertBreadboardType,
  type JsonSerializable,
} from "./type.js";

type Intersectable = AdvancedBreadboardType<{ [K: string]: JsonSerializable }>;

/**
 * Intersect takes 2 or more types and returns their intersection. It uses the
 * `&` operator for TypeScript, and a custom object-combiner for JSON Schema.
 *
 * Note the following requirements:
 *
 * - There must be at least 2 arguments.
 * - All arguments must be JSON objects.
 * - No two arguments can share a property.
 * - Additional properties must be set to true or false, but otherwise not
 *   constrained.
 */
export function intersect<
  T extends [Intersectable, Intersectable, ...Intersectable[]],
>(...members: T): AdvancedBreadboardType<IntersectArrayMembersRecursively<T>> {
  // TODO(aomarks) This function is somewhat limited. We can likely use JSON
  // Schema's `allOf` to support more cases, but we need to be very careful
  // about the semantics of "additionalProperties".
  if (members.length < 2) {
    throw new Error(
      `intersect requires at least 2 arguments, got ${members.length}`
    );
  }
  const properties: Record<string, JSONSchema4> = {};
  let additionalProperties = false;
  const required = new Set<string>();
  for (const member of members) {
    const converted = toJSONSchema(member);
    if (converted.type !== "object") {
      throw new Error(`intersect only supports objects, got ${converted.type}`);
    }
    if (converted.properties !== undefined) {
      for (const [name, schema] of Object.entries(converted.properties)) {
        if (properties[name]) {
          throw new Error(
            `intersect only supports disjoint properties, ` +
              `got "${name}" 2 or more times`
          );
        }
        properties[name] = schema;
      }
    }
    if (converted.required !== undefined) {
      for (const name of converted.required as string[]) {
        required.add(name);
      }
    }
    if (converted.additionalProperties === true) {
      additionalProperties = true;
    } else if (converted.additionalProperties) {
      throw new Error(
        `intersect only supports closed or fully open objects, got ` +
          JSON.stringify({
            additionalProperties: converted.additionalProperties,
          })
      );
    }
  }
  return {
    jsonSchema: {
      type: "object",
      properties,
      required: [...required],
      additionalProperties,
    },
  };
}

export type IntersectArrayMembersRecursively<ALL extends BreadboardType[]> =
  ALL extends [
    infer ITEM extends BreadboardType,
    ...infer REST extends BreadboardType[],
  ]
    ? ConvertBreadboardType<ITEM> & IntersectArrayMembersRecursively<REST>
    : unknown;
