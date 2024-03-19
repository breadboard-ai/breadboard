/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A subset of JSON schema types which can be converted to TypeScript types at
 * compile time.
 */
export type BreadboardType =
  | BasicBreadboardType
  | AdvancedBreadboardType<unknown>;

export type BasicBreadboardType = "string" | "number" | "boolean";

const AdvancedType = Symbol();

export interface AdvancedBreadboardType<T> {
  readonly [AdvancedType]: T;
  toJSONSchema(): JSONSchema;
}

/**
 * The TypeScript types that can be automatically mapped back to
 * BreadboardTypes.
 */
export type BreadboardTypeScriptTypes = string | number | boolean;

/**
 * Convert from {@link BreadboardType} to TypeScript type.
 */
export type TypeScriptTypeFromBreadboardType<BT extends BreadboardType> =
  BT extends "string"
    ? string
    : BT extends "number"
      ? number
      : BT extends "boolean"
        ? boolean
        : BT extends AdvancedBreadboardType<unknown>
          ? BT[typeof AdvancedType]
          : never;

/**
 * Convert from TypeScript type to {@link BreadboardType}.
 */
export type BreadboardTypeFromTypeScriptType<
  TT extends BreadboardTypeScriptTypes,
> = TT extends string
  ? "string"
  : TT extends number
    ? "number"
    : TT extends boolean
      ? "boolean"
      : never;

export type JSONSchema =
  | { type: "string" | "number" | "boolean" }
  | { anyOf: JSONSchema[] };

export function toJSONSchema(type: BreadboardType): JSONSchema {
  return typeof type === "string" ? { type } : type.toJSONSchema();
}

export function anyOf<
  T extends [BreadboardType, BreadboardType, ...BreadboardType[]],
>(...members: T) {
  return new AnyOf<T>(members);
}

export type { AnyOf };
class AnyOf<T extends [BreadboardType, BreadboardType, ...BreadboardType[]]> {
  #members: T;
  readonly [AdvancedType]!: TypeScriptTypeFromBreadboardType<T[number]>;

  constructor(members: T) {
    this.#members = members;
  }

  toJSONSchema(): JSONSchema {
    return {
      anyOf: this.#members.map(toJSONSchema),
    };
  }
}
