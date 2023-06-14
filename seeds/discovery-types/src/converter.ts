/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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

export class Converter {
  convertSchema(schema: Schema): string {
    const name = schema.id;
    const comment = this.asComment(schema.description);
    const type = this.convertType(schema);
    return `${comment}export interface ${name} ${type}`;
  }

  convertType(schema: Schema): string {
    if (schema.$ref) return schema.$ref;
    if (schema.enum) return this.convertEnum(schema);
    if (schema.type == "integer") return "number";
    if (schema.type == "array") return this.convertArray(schema.items);
    if (schema.type != "object") return schema.type;

    return `{\n${sorted(schema.properties)
      .map(([name, property]) => {
        const comment = this.asComment(property.description);
        const isRequired = comment && comment.startsWith("Required.");
        const readonly = property.readonly ? "readonly" : "";
        const optional = property.required || isRequired ? "" : "?";
        const type = this.convertType(property);
        return `${comment}${readonly}${name}${optional}: ${type}`;
      })
      .join("\n")}\n}`;
  }

  convertArray(items: Schema): string {
    return `${this.convertType(items)}[]`;
  }

  convertEnum(schema: Schema): string {
    const values = schema.enum || [];
    return `${values.map((v) => `"${v}"`).join(" | ")}`;
  }

  asComment(value: string): string {
    return `\n/**\n * ${value
      .split("\n")
      .join("\n * ")
      .replace(/\*\//g, "*\\/")} */\n`;
  }

  convertDoc(doc: DiscoveryDoc): string {
    return sorted(doc.schemas)
      .map(([_name, schema]) => this.convertSchema(schema))
      .join("\n");
  }
}
