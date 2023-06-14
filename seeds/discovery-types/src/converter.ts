/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This is a minimal implementation of the Discovery Document to TypeScript converter.
 * It is not intended to be a complete implementation, rather just enough code
 *  to parse the Discovery doc for https://developers.generativeai.google/api/rest/generativelanguage
 * and produce decent TypeScript definitions for the request/response objects.
 */

export interface Schema {
  id: string;
  $ref: string;
  readonly: boolean;
  required: boolean;
  description: string;
  enum?: string[];
  enumDescriptions?: string[];
  type: string;
  items: Schema;
  properties: Record<string, Schema>;
}

export interface DiscoveryDoc {
  schemas: Record<string, Schema>;
}

const sorted = (o: Record<string, Schema>): [string, Schema][] => {
  const result = Object.entries(o);
  result.sort();
  return result;
};

const toInterface = (schema: Schema): string => {
  const name = schema.id;
  const comment = toComment(schema.description);
  const type = toType(schema);
  return `${comment}export interface ${name} ${type}`;
};

const toType = (schema: Schema): string => {
  if (schema.$ref) return schema.$ref;
  if (schema.enum) return toEnum(schema);
  if (schema.type == "integer") return "number";
  if (schema.type == "array") return toArray(schema.items);
  if (schema.type != "object") return schema.type;

  return `{\n${sorted(schema.properties)
    .map(([name, property]) => {
      const comment = toComment(property.description);
      const isRequired = comment && comment.startsWith("Required.");
      const readonly = property.readonly ? "readonly" : "";
      const optional = property.required || isRequired ? "" : "?";
      const type = toType(property);
      return `${comment}${readonly}${name}${optional}: ${type}`;
    })
    .join("\n")}\n}`;
};

const toArray = (items: Schema): string => {
  return `${toType(items)}[]`;
};

const toEnum = (schema: Schema): string => {
  const values = schema.enum || [];
  return `${values.map((v) => `"${v}"`).join(" | ")}`;
};

const toComment = (value: string): string => {
  return `\n/**\n * ${value
    .split("\n")
    .join("\n * ")
    .replace(/\*\//g, "*\\/")} */\n`;
};

export const fromDoc = (doc: DiscoveryDoc): string => {
  return sorted(doc.schemas)
    .map(([_name, schema]) => toInterface(schema))
    .join("\n");
};
