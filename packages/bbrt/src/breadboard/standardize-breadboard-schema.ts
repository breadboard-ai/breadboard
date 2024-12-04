/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema } from "@google-labs/breadboard";
import type { JSONSchema7 } from "json-schema";

/**
 * Takes a Breadboard input or output schema, which is JSON schema with some
 * additions like "behaviors", and emits a standard JSON Schema.
 */
export function standardizeBreadboardSchema(schema: Schema): JSONSchema7 {
  return visit(structuredClone(schema));
}

function visit(obj: Schema): JSONSchema7 {
  if (typeof obj === "object" && obj !== null) {
    if (obj.type !== undefined) {
      delete obj.behavior;
      if (obj.type === "object") {
        return visitObject(obj);
      }
    }
  }
  return obj as JSONSchema7;
}

function visitObject(obj: Schema): JSONSchema7 {
  if (obj.properties !== undefined) {
    for (const [propName, propValue] of Object.entries(obj.properties)) {
      (obj.properties as Record<string, JSONSchema7>)[propName] =
        visit(propValue);
    }
  }
  return obj as object as JSONSchema7;
}
