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

export function object<
  T extends Record<string, BreadboardType | OptionalProperty>,
>(
  properties: T
): AdvancedBreadboardType<
  keyof T extends never
    ? object & JsonSerializable
    : Expand<
        {
          [P in keyof T as T[P] extends BreadboardType
            ? P
            : never]: T[P] extends BreadboardType
            ? ConvertBreadboardType<T[P]>
            : never;
        } & {
          [P in keyof T as T[P] extends OptionalProperty
            ? P
            : never]?: T[P] extends OptionalProperty<infer OT>
            ? ConvertBreadboardType<OT>
            : never;
        }
      >
>;

export function object<
  T extends Record<string, BreadboardType | OptionalProperty>,
  A extends BreadboardType,
>(
  properties: T,
  additional: A
): AdvancedBreadboardType<
  Expand<
    { [x: string]: ConvertBreadboardType<A> } & {
      [P in keyof T as T[P] extends BreadboardType
        ? P
        : never]: T[P] extends BreadboardType
        ? ConvertBreadboardType<T[P]>
        : never;
    } & {
      [P in keyof T as T[P] extends OptionalProperty
        ? P
        : never]?: T[P] extends OptionalProperty<infer OT>
        ? ConvertBreadboardType<OT>
        : never;
    }
  >
>;

/**
 * Make a Breadboard type for an object.
 *
 * @param properties Object mapping from property name to Breadboard Type. Wrap
 * the Breadboard Type with {@link optional} to make the property optional.
 * @param additional A Breadboard Type that is allowed for additional properties
 * (meaning ones not listed in {@link properties}). If ommitted, no additional
 * properties are allowed.
 */
export function object(
  properties: Record<string, BreadboardType | OptionalProperty>,
  additional?: BreadboardType
): AdvancedBreadboardType<JsonSerializable> {
  const jsonSchema: JSONSchema4 = {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(properties).map(([name, type]) => [
        name,
        toJSONSchema(isOptional(type) ? type.type : type),
      ])
    ),
  };
  jsonSchema.required = Object.entries(properties)
    .filter(([_, type]) => !isOptional(type))
    .map(([name]) => name);
  if (additional === undefined) {
    jsonSchema.additionalProperties = false;
  } else if (additional === "unknown") {
    jsonSchema.additionalProperties = true;
  } else {
    jsonSchema.additionalProperties = toJSONSchema(additional);
  }
  return { jsonSchema };
}

/**
 * Wraps a type to indicate that a property is optional in the context of
 * declaring an {@link object} type.
 */
export function optional<T extends BreadboardType>(
  propertyType: T
): OptionalProperty<T> {
  return { __isOptionalProperty: true, type: propertyType };
}

interface OptionalProperty<T extends BreadboardType = BreadboardType> {
  __isOptionalProperty: true;
  type: T;
}

function isOptional<T extends BreadboardType>(
  value: T | OptionalProperty<T>
): value is OptionalProperty<T> {
  return (value as Partial<OptionalProperty<T>>).__isOptionalProperty === true;
}
