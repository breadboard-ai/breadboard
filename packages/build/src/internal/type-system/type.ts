/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";

/**
 * A `BreadboardType` is an object that can be serialized to JSON Schema for
 * runtime, and also carries a matching TypeScript type for compile time.
 */
export type BreadboardType =
  | BasicBreadboardType
  | AdvancedBreadboardType<unknown>;

/**
 * Convert a {@link BreadboardType} to JSON Schema.
 */
export function toJSONSchema(type: BreadboardType): JSONSchema4 {
  return typeof type === "string" ? { type } : type.jsonSchema;
}

/**
 * The basic types that can be referenced directly.
 */
export type BasicBreadboardType = "string" | "number" | "boolean";

/**
 * A type that's more complicated than a {@link BasicBreadboardType}.
 *
 * By implementing this interface, you are providing a function that will
 * convert you to a JSON Schema at runtime, and also to a TypeScript type at
 * compile time via {@link ConvertBreadboardType}.
 */
export interface AdvancedBreadboardType<
  // We only need to hold onto this type parameter so that we can infer it
  // later.
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  T,
> {
  readonly jsonSchema: JSONSchema4;
}

/**
 * Convert from {@link BreadboardType} to TypeScript type.
 */
export type ConvertBreadboardType<BT extends BreadboardType> =
  BT extends "string"
    ? string
    : BT extends "number"
      ? number
      : BT extends "boolean"
        ? boolean
        : BT extends AdvancedBreadboardType<infer TT>
          ? TT
          : never;
