/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema } from "@google-labs/breadboard";
import type { JSONSchema7 } from "json-schema";

/**
 * Takes a Breadboard input or output schema, which is JSON Schema with
 * additions like the `behaviors` property, and some modifications like
 * JSON-encoding the `default` property, and emits a standard JSON Schema.
 *
 * Note this function removes known-invalid properties, but preserves unknown
 * properties.
 */
export function standardizeBreadboardSchema(breadboard: Schema): JSONSchema7 {
  return visit(structuredClone(breadboard));
}

function visit(node: Schema): JSONSchema7 {
  if (typeof node === "object" && node !== null && node.type !== undefined) {
    // The `llm-content` behavior carries a lot of weight in Breadboard schema;
    // it's not just an annotation, but actually determines the entire schema.
    // Replace it with an equivalent real JSON schema.
    node = expandLlmContent(node);

    // Behaviors are not part of standard JSON Schema.
    delete node.behavior;

    // Defaults are not JSON-encoded in standard JSON Schema.
    if (node.type !== "string") {
      if (typeof node.default === "string") {
        node.default = JSON.parse(node.default);
      }
      if (node.examples !== undefined) {
        for (let i = 0; i < node.examples.length; i++) {
          if (typeof node.examples[i] === "string") {
            node.examples[i] = JSON.parse(node.examples[i]!);
          }
        }
      }
    }

    if (node.type === "object") {
      return visitObject(node);
    } else if (node.type === "array") {
      return visitArray(node);
    }
  }
  return node as JSONSchema7;
}

function visitObject(obj: Schema): JSONSchema7 {
  if (obj.properties !== undefined) {
    for (const [name, value] of Object.entries(obj.properties)) {
      (obj.properties as Record<string, JSONSchema7>)[name] = visit(value);
    }
  }
  return obj as object as JSONSchema7;
}

function visitArray(arr: Schema): JSONSchema7 {
  if (Array.isArray(arr.items)) {
    for (let i = 0; i < arr.items.length; i++) {
      (arr.items as Array<JSONSchema7>)[i] = visit(arr.items[i]!);
    }
  } else if (arr.items !== undefined) {
    (arr as JSONSchema7).items = visit(arr.items);
  }
  return arr as object as JSONSchema7;
}

const GEMINI_PART_SCHEMA: JSONSchema7 = {
  type: "object",
  required: ["text"],
  properties: {
    text: { type: "string" },
    // TODO(aomarks) Add other part types like `inlineData` if needed.
  },
};

const GEMINI_CONTENT_SCHEMA: JSONSchema7 = {
  type: "object",
  required: ["role", "parts"],
  properties: {
    role: {
      type: "string",
      enum: ["user", "model"],
    },
    parts: {
      type: "array",
      items: GEMINI_PART_SCHEMA,
    },
  },
};

const GEMINI_CONTENT_ARRAY_SCHEMA: JSONSchema7 = {
  type: "array",
  items: GEMINI_CONTENT_SCHEMA,
};

function expandLlmContent(node: Schema): Schema {
  if (node.behavior !== undefined && node.behavior.includes("llm-content")) {
    if (node.type === "object") {
      Object.assign(node, GEMINI_CONTENT_SCHEMA);
    } else if (node.type === "array") {
      Object.assign(node, GEMINI_CONTENT_ARRAY_SCHEMA);
    }
  }
  return node;
}
