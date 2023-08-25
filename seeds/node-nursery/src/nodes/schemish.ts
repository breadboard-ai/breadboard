/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/graph-runner";
import { Schema } from "jsonschema";

export const convert = (schema: Schema): NodeValue => {
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

export default async (inputs: InputValues): Promise<OutputValues> => {
  const { schema } = inputs;
  return { schemish: convert(schema as Schema) };
};
