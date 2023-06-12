/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Enum = string[];

export interface Schema {
  id: string;
  $ref: string;
  readonly: boolean;
  required: boolean;
  description: string;
  enum: Enum;
  type: string;
  items: string[];
  properties: Record<string, Schema>;
}

export interface DiscoveryDoc {
  schemas: Record<string, Schema>;
}

export class Converter {
  convertSchema(schema: Schema): string {
    const name = schema.id;
    const comment = this.asComment(schema.description);
    const type = this.convertType(schema);
    return `${comment}export interface ${name} ${type}`;
  }

  convertType(schema: Schema): string {
    if (schema.$ref) return schema.$ref;
    if (schema.enum) return this.convertEnum(schema.enum);
    if (schema.type == "integer") return "number";
    if (schema.type == "array") return this.convertArray(schema.items);
    if (schema.type != "object") return schema.type;

    return `{\n${Object.entries(schema.properties)
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

  convertArray(items: any): string {
    return "array";
  }

  convertEnum(value: Enum): string {
    return "enum";
  }

  asComment(value: string): string {
    return `\n/**\n * ${value
      .split("\n")
      .join("\n * ")
      .replace(/\*\//g, "*\\/")} */\n`;
  }

  convertDoc(doc: DiscoveryDoc): string {
    return Object.entries(doc.schemas)
      .map(([_name, schema]) => this.convertSchema(schema))
      .join("\n");
  }
}
