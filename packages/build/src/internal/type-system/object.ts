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
 * Make a Breadboard type for an object.
 *
 * @param properties A map from property name to Breadboard Type.
 */
export function object<T extends Record<string, BreadboardType>>(
  properties: T
): AdvancedBreadboardType<{
  [P in keyof T]: ConvertBreadboardType<T[P]>;
}> {
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
