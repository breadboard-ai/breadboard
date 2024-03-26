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
  | AdvancedBreadboardType<JsonSerializable>;

/**
 * The basic Breadboard types that can be written directly.
 */
export type BasicBreadboardType = "string" | "number" | "boolean" | "unknown";

/**
 * All Breadboard values must be JSON serializable, and this is the set of
 * JSON serializable types.
 */
export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | Array<JsonSerializable>
  | { [K: string]: JsonSerializable };

/**
 * A type that's more complicated than a {@link BasicBreadboardType}. Directly
 * owns a TypeScript type for compile time, and a JSON schema for run time.
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
        : BT extends "unknown"
          ? JsonSerializable
          : BT extends AdvancedBreadboardType<infer TT>
            ? TT
            : never;

/**
 * Convert a {@link BreadboardType} to JSON Schema.
 */
export function toJSONSchema(type: BreadboardType): JSONSchema4 {
  if (typeof type === "object" && "jsonSchema" in type) {
    return type.jsonSchema;
  }
  switch (type) {
    case "string":
    case "number":
    case "boolean": {
      return { type };
    }
    case "unknown": {
      // {} is our equivalent to TypeScript's `unknown` in JSON Schema, since it
      // enforces no type constraints at all.
      return {};
    }
    default: {
      throw new Error(
        `Unknown BreadboardType: <${typeof type}> ${type satisfies never}`
      );
    }
  }
}
