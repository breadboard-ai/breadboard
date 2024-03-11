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
