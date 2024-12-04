/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { GeminiParameterSchema } from "./gemini-types.js";

/**
 * Gemini only supports a subset of JSON Schema for function calling. See
 * https://ai.google.dev/api/caching#Schema for details.
 */
export function adjustSchemaForGemini(
  schema: JSONSchema7
): GeminiParameterSchema | undefined {
  return visit(structuredClone(schema));
}

function visit(node: JSONSchema7Definition): GeminiParameterSchema | undefined {
  if (typeof node === "object" && node !== null && node.type !== undefined) {
    // Gemini doesn't support these fields.
    delete node["title"];
    delete node["default"];
    delete node["examples"];

    if (node.type === "object") {
      return visitObject(node);
    } else if (node.type === "array") {
      return visitArray(node);
    }
  }
  return node as GeminiParameterSchema;
}

function visitObject(obj: JSONSchema7): GeminiParameterSchema | undefined {
  delete obj["additionalProperties"];
  if (obj.properties !== undefined) {
    for (const [name, value] of Object.entries(obj.properties)) {
      const newValue = visit(value);
      if (newValue === undefined) {
        delete obj.properties[name];
      } else {
        obj.properties[name] = newValue;
      }
    }
  }
  if (
    obj.properties === undefined ||
    Object.keys(obj.properties).length === 0
  ) {
    // Gemini can't handle an object with no properties.
    return undefined;
  }
  return obj as object as GeminiParameterSchema;
}

function visitArray(arr: JSONSchema7): GeminiParameterSchema {
  if (Array.isArray(arr.items)) {
    arr.items = arr.items
      .map((item) => visit(item))
      .filter((item) => item !== undefined);
  } else if (arr.items !== undefined) {
    arr.items = visit(arr.items);
  }
  return arr as object as GeminiParameterSchema;
}
