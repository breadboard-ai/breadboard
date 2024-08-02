/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdvancedBreadboardType } from "./type.js";

/**
 * JSON Schema options for strings.
 */
export interface StringOptions {
  /** https://json-schema.org/understanding-json-schema/reference/string#format */
  format?: string;
  /** https://json-schema.org/understanding-json-schema/reference/string#regexp */
  pattern?: string;
  /** https://json-schema.org/understanding-json-schema/reference/string#length */
  minLength?: number;
  /** https://json-schema.org/understanding-json-schema/reference/string#length */
  maxLength?: number;
}

/**
 * Create a string type with additional options.
 */
export function string(options: StringOptions): AdvancedBreadboardType<string> {
  return { jsonSchema: { type: "string", ...options } };
}
