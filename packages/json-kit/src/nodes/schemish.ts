/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeHandlerObject,
  SchemaBuilder,
  type InputValues,
  type NodeValue,
  type OutputValues,
  type Schema,
} from "@google-labs/breadboard";

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

export type SchemishInputs = InputValues & {
  /**
   * The schema to convert to schemish.
   */
  schema: NodeValue;
};

export type SchemishOutputs = OutputValues & {
  /**
   * The schemish object.
   */
  schemish: NodeValue;
};

const invoke = async (inputs: InputValues): Promise<OutputValues> => {
  const { schema } = inputs;
  return { schemish: convert(schema as Schema) };
};

const describe = async () => {
  const inputSchema = new SchemaBuilder()
    .addProperty("schema", {
      title: "schema",
      description: "The schema to convert to schemish.",
      type: "object",
    })
    .addRequired("schema")
    .build();

  const outputSchema = new SchemaBuilder()
    .addProperty("schemish", {
      title: "schemish",
      description: "The schemish object.",
      type: "object",
    })
    .addRequired("schemish")
    .build();

  return { inputSchema, outputSchema };
};

export default {
  metadata: {
    title: "Schemish",
    description:
      "Converts a JSON schema to Schemish (https://glazkov.com/2023/05/06/schemish/)",
    deprecated: true,
  },
  invoke,
  describe,
} as NodeHandlerObject;
