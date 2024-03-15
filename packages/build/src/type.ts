/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A subset of JSON schema types which can be converted to TypeScript types at
 * compile time.
 */
export type BreadboardType = "string" | "number" | "boolean";

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
