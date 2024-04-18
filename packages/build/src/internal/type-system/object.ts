/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";
import type { Expand } from "../common/type-util.js";
import {
  toJSONSchema,
  type AdvancedBreadboardType,
  type BreadboardType,
  type ConvertBreadboardType,
  type JsonSerializable,
} from "./type.js";

export function object<T extends Record<string, BreadboardType>>(
  properties: T
): AdvancedBreadboardType<
  keyof T extends never
    ? object & JsonSerializable
    : { [P in keyof T]: ConvertBreadboardType<T[P]> }
>;

export function object<
  T extends Record<string, BreadboardType>,
  A extends BreadboardType,
>(
  properties: T,
  additional: A
): AdvancedBreadboardType<
  Expand<
    { [x: string]: ConvertBreadboardType<A> } & {
      [P in keyof T]: ConvertBreadboardType<T[P]>;
    }
  >
>;

/**
 * Make a Breadboard type for an object.
 *
 * @param properties Object mapping from property name to Breadboard Type.
 * @param additional A Breadboard Type that is allowed for additional properties
 * (meaning ones not listed in {@link properties}). If ommitted, no additional
 * properties are allowed.
 */
export function object(
  properties: Record<string, BreadboardType>,
  additional?: BreadboardType
): AdvancedBreadboardType<JsonSerializable> {
  const jsonSchema: JSONSchema4 = { type: "object" };
  if (Object.keys(properties).length > 0) {
    jsonSchema.properties = Object.fromEntries(
      Object.entries(properties).map(([name, type]) => [
        name,
        toJSONSchema(type),
      ])
    );
    jsonSchema.required = Object.keys(properties);
  }
  if (additional === undefined) {
    jsonSchema.additionalProperties = false;
  } else if (additional === "unknown") {
    // This is the JSON Schema default if you omit additionalProperties.
  } else {
    jsonSchema.additionalProperties = toJSONSchema(additional);
  }
  return { jsonSchema };
}
