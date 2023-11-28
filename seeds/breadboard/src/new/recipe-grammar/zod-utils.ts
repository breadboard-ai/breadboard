/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { Schema } from "../../types.js";

import { NodeFactory } from "./types.js";
import { InputValues, OutputValues } from "../runner/types.js";

/**
 * This post processed JSON schema generated from Zod:
 *  - adds a title to the schema or any field by parsing the description as
 *    `${title}: ${description}`
 *  - removes $schema field
 *
 * @param zod Zod schema
 * @returns Post processed `Schema` object
 */
export function zodToSchema(zod: z.ZodType<unknown>): Schema {
  const schema = zodToJsonSchema(zod) as Schema & { $schema?: string };
  delete schema.$schema;

  // Recursively visit all fields and add titles from descriptions
  const addTitles = (schema: Schema) => {
    if (schema.description) {
      const [title, description] = schema.description.split(":", 2);
      schema.title = title.trim();
      schema.description = description.trim();
    }
    if (schema.properties)
      Object.values(schema.properties).forEach((property) =>
        addTitles(property)
      );
  };

  addTitles(schema);

  return schema;
}

export function convertZodToSchemaInConfig<
  I extends InputValues,
  O extends OutputValues
>(
  config: { schema?: z.ZodType | Schema; $id?: string },
  factory: NodeFactory<I, O>
) {
  if (config.schema && config.schema instanceof z.ZodType) {
    config.schema = zodToSchema(config.schema);
  }
  return factory(config as Partial<I>);
}
