/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, Schema } from "./types.js";

export type SchemaProperties = Record<string, Schema>;

export type SchemaType =
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
  additionalProperties = false;
  required: string[] = [];
  properties: SchemaProperties = {};

  build(): Schema {
    const result: Schema = {
      type: "object",
      properties: this.properties,
      additionalProperties: this.additionalProperties,
    };
    if (this.required.length > 0) {
      result.required = this.required;
    }
    return result;
  }

  setAdditionalProperties(additionalProperties?: boolean) {
    if (additionalProperties !== undefined) {
      this.additionalProperties = additionalProperties;
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

  addProperties(properties: SchemaProperties) {
    Object.entries(properties).forEach(([name, schema]) => {
      this.addProperty(name, schema);
    });
    return this;
  }

  addRequired(required?: string[] | string) {
    if (!required) return this;

    if (typeof required === "string") {
      this.required = [...this.required, required];
    } else if (Array.isArray(required) && required.length > 0) {
      this.required = [...this.required, ...required];
    }
    return this;
  }

  static empty(additionalProperties = false): Schema {
    return new SchemaBuilder()
      .setAdditionalProperties(additionalProperties)
      .build();
  }
}
