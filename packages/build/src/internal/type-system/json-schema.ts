/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "@google-labs/breadboard";
import { unsafeType } from "./unsafe.js";

/**
 * The Breadboard Type Expression for JSON Schema itself. Use this when you need
 * to declare an input or output port whose type is itself a JSON Schema object.
 */
export const jsonSchema = unsafeType<Schema>(
  // TODO(aomarks) Replace with the official JSONSchema7 type and
  // { $ref: "https://json-schema.org/draft-07/schema#" }. But we first need to
  // support $ref schemas more broadly, and possibly align our Schema vs
  // JSONSchema7 types.
  {
    type: "object",
    behavior: ["json-schema"],
    properties: {},
    required: [],
    additionalProperties: true,
  }
);
