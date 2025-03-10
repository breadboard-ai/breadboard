/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema } from "@google-labs/breadboard";

export function isMultiline(schema: Schema) {
  return (
    schema.format === "multiline" ||
    schema.type === "object" ||
    schema.type === "array"
  );
}

export function isSelect(schema: Schema) {
  return schema.enum && schema.enum.length > 0;
}

export function isBoolean(schema: Schema) {
  return schema.type == "boolean";
}
