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
  type JsonSerializable,
} from "./type.js";

/**
 * Make a Breadboard type for an object.
 *
 * @param properties A map from property name to Breadboard Type.
 */
export function object<T extends Record<string, BreadboardType>>(
  properties: T
): AdvancedBreadboardType<
  keyof T extends never
    ? object & JsonSerializable
    : { [P in keyof T]: ConvertBreadboardType<T[P]> }
> {
  if (Object.keys(properties).length === 0) {
    return {
      jsonSchema: {
        type: "object",
      },
    };
  }
  return {
    jsonSchema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(properties).map(([name, type]) => [
          name,
          toJSONSchema(type),
        ])
      ),
      required: Object.keys(properties),
    },
  };
}
