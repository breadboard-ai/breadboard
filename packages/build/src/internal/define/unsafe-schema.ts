/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema } from "@google-labs/breadboard";
import type { JSONSchema4 } from "json-schema";

/**
 * Can be used in a node definition's `describe` function to directly specify
 * some raw JSON schema, instead of a normal `@breadboard-ai/build` port
 * configuration.
 *
 * Useful for cases like the `invoke` node where we need to trust that the
 * schema returned by some dynamically loaded board is valid.
 */
export function unsafeSchema(schema: JSONSchema4 | Schema): UnsafeSchema {
  return { [unsafeSchemaAccessor]: schema as JSONSchema4 };
}

/** Checks whether an object was created by {@link unsafeSchema}. */
export function isUnsafeSchema(value: unknown): value is UnsafeSchema {
  return (
    typeof value === "object" && value !== null && unsafeSchemaAccessor in value
  );
}

/** The interface for {@link unsafeSchema}. */
export interface UnsafeSchema {
  [unsafeSchemaAccessor]: JSONSchema4;
}

/** A package-private accessor for {@link unsafeSchema}. */
export const unsafeSchemaAccessor = Symbol();
