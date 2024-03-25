/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdvancedBreadboardType } from "./type.js";
import type { JSONSchema4 } from "json-schema";

/**
 * If none of the included type utilities are able to express both the required
 * JSON Schema and its corresponding TypeScript type you need, then `unsafeType`
 * can be used to manually create a type that directly specifies both.
 *
 * This function is called `unsafeType` because there is no guarantee that the
 * JSON Schema and TypeScript types you specify are actually equivalent, hence
 * it must be used with care. Prefer using one of the provided types if
 * possible, and consider filing a feature request if you think a type should be
 * natively supported.
 *
 * Example:
 *
 * ```ts
 * import {unsafeType} from "@breadboard-ai/build";
 *
 * const myCrazyType = unsafeType<{foo: string}>({
 *   type: "object",
 *   properties: {
 *     foo: {
 *       type: "string"
 *     }
 *   },
 *   required: ["foo"]
 * });
 * ```
 *
 * @param jsonSchema The JSON schema that will always be returned when a port
 * has this type.
 * @returns A `BreadboardType` which carries both the TypeScript type provided
 * via the `T` generic parameter, and the corresponding JSON schema.
 */
export function unsafeType<T>(
  jsonSchema: JSONSchema4
): AdvancedBreadboardType<T> {
  return { jsonSchema };
}
