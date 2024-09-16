/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, jsonSchema } from "@breadboard-ai/build";
import type { NodeValue, Schema } from "@google-labs/breadboard";

export const convert = (schema: Schema): NodeValue => {
  if (!schema.type) {
    return "Any JSON object";
  }
  if (schema.type === "string" || schema.type === "number") {
    const result = `${schema.type}, ${schema.description}`;
    const { enum: validValues } = schema;
    if (validValues) {
      return `${result} (one of: ${validValues
        .map((value) => `"${value}"`)
        .join(", ")})`;
    }
    return result;
  }
  if (schema.type === "object") {
    const result: NodeValue = {};
    const properties = schema.properties as Record<string, Schema>;
    for (const [name, property] of Object.entries(properties)) {
      result[name] = convert(property);
    }
    return result;
  }
  if (schema.type === "array") {
    const items = (schema.items as Schema) || {};
    return [convert(items)];
  }
  throw new Error(
    `Failed to translate this schema to schemish:\n${JSON.stringify(
      schema,
      null,
      2
    )}`
  );
};

export default defineNodeType({
  name: "schemish",
  metadata: {
    title: "Schemish",
    description:
      "Converts a JSON schema to Schemish (https://glazkov.com/2023/05/06/schemish/)",
    deprecated: true,
  },
  inputs: {
    schema: {
      title: "schemish",
      description: "The schema to convert to schemish.",
      type: jsonSchema,
    },
  },
  outputs: {
    schemish: {
      title: "schemish",
      description: "The schemish object.",
      type: "unknown",
    },
  },
  invoke: ({ schema }) => ({ schemish: convert(schema) }),
});
