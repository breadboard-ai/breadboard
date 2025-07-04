/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, Schema } from "@breadboard-ai/types";

type SchemaProperties = Record<string, Schema>;

type SchemaType =
  | "null"
  | "boolean"
  | "object"
  | "array"
  | "number"
  | "integer"
  | "string";

export const getSchemaType = (value: unknown): SchemaType => {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value as SchemaType;
};

export class SchemaBuilder {
  type = "object";
  additionalProperties = false;
  required: string[] = [];
  properties: SchemaProperties = {};

  build(): Schema {
    const result: Schema = {
      type: "object",
      properties: this.properties,
    };
    if (!this.additionalProperties) {
      result.additionalProperties = false;
    }
    if (this.required.length > 0) {
      result.required = this.required;
    }
    return result;
  }

  addSchema(schema: Schema) {
    if (schema.type === "object") {
      this.addProperties(schema.properties);
      this.addRequired(schema.required);
      this.setAdditionalProperties(schema.additionalProperties as boolean);
    }
    return this;
  }

  setAdditionalProperties(additionalProperties?: Schema | boolean) {
    if (additionalProperties !== undefined) {
      this.additionalProperties = !!additionalProperties;
    }
    return this;
  }

  addInputs(inputs?: InputValues) {
    if (!inputs) return this;
    Object.entries(inputs).forEach(([name, value]) => {
      this.addProperty(name, { type: getSchemaType(value) });
    });
    return this;
  }

  addProperty(name: string, schema: Schema) {
    this.properties[name] = schema;
    return this;
  }

  addProperties(properties?: SchemaProperties) {
    if (!properties) return this;
    Object.entries(properties).forEach(([name, schema]) => {
      this.addProperty(name, schema);
    });
    return this;
  }

  addRequired(required?: string[] | string) {
    if (!required) return this;

    if (typeof required === "string") {
      this.required = [...new Set([...this.required, required])];
    } else if (Array.isArray(required) && required.length > 0) {
      this.required = [...new Set([...this.required, ...required])];
    }
    this.required.sort();
    return this;
  }

  static empty(additionalProperties = false): Schema {
    return new SchemaBuilder()
      .setAdditionalProperties(additionalProperties)
      .build();
  }
}

/**
 * Provides a way to manually handle schema merging.
 * Currently only invoked to handle the `additionalProperties` property.
 */
type ReducerFunction = (result: Schema, schema: Schema) => void;

/**
 * Combines multiple schemas into a single schema. This is lossy, since
 * the same-named properties will be overridden (last one wins). However,
 * it's good enough to communicate the overall shape of the combined schema.
 * @param schemas - the schemas to combine
 * @returns - the combined schema
 */
export const combineSchemas = (
  schemas: Schema[],
  reducer?: ReducerFunction
): Schema => {
  const result: Schema = {};
  schemas.forEach((schema) => {
    if (schema.type === "object") {
      if (schema.properties) {
        result.properties = { ...result.properties, ...schema.properties };
      }
      if (schema.required) {
        result.required = [
          ...(result.required ?? []),
          ...(schema.required ?? []),
        ];
      }
      if (reducer) {
        reducer(result, schema);
      } else {
        if (schema.additionalProperties !== undefined) {
          result.additionalProperties = schema.additionalProperties;
        }
      }
    }
    if (schema.behavior) {
      result.behavior ??= [];
      result.behavior.push(...schema.behavior);
    }
  });
  result.type = "object";
  if (result.required) {
    result.required = [...new Set(result.required)];
    result.required?.sort();
  }
  return result;
};

/**
 * Removes a property from a schema (assumes it to be type = object).
 *
 * @param schema -- Schema to remove the property from
 * @param property -- the property to remove
 * @returns -- a new Schema instance with removed property.
 */
export const removeProperty = (schema: Schema, property: string): Schema => {
  const entries = Object.entries(schema.properties || {});
  if (entries.length == 0) {
    return schema;
  }
  const index = entries.findIndex(([name]) => {
    return name === property;
  });
  if (index == -1) {
    return schema;
  }
  entries.splice(index, 1);
  return {
    ...schema,
    properties: Object.fromEntries(entries),
  };
};

export const filterBySchema = <T extends Record<string, unknown>>(
  values: T,
  schema?: Schema
): T => {
  const names = Object.keys(schema?.properties || {});
  return Object.fromEntries(
    Object.entries(values).filter(([name]) => names.includes(name))
  ) as T;
};
