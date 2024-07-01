/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { $id as boardSchemaId } from "@google-labs/breadboard-schema/breadboard.schema.json" with { type: "json" };
import fs from "fs";
import { Schema, createGenerator, type Config } from "ts-json-schema-generator";
import { DEFAULT_CONFIG } from "../generate";
import { ABSOLUTE_SCHEMA_PATH } from "./constants";
import { sortObject } from "./sort-objects";
export function generateSchemaFile(
  conf: Partial<Config> = {},
  postProcessor: (s: Schema) => Schema = (s: Schema): Schema => {

    const graphDescriptorRef = `${boardSchemaId}#/definitions/GraphDescriptor`;

    s.definitions!["Board"] = {
      ...(s.definitions!["Board"] as Schema),
      type: "object",
      $ref: graphDescriptorRef,
      // additionalProperties: false,
    } satisfies Schema;

    return sortObject(s);
  }
) {
  console.debug(
    "Generating schema with config:",
    JSON.stringify(conf, null, 2)
  );

  const mergedConfig: Config = {
    ...DEFAULT_CONFIG,
    ...conf,
  };

  const schema: Schema = postProcessor(
    createGenerator(mergedConfig).createSchema(mergedConfig.type)
  );

  const schemaString = JSON.stringify(schema, null, "\t");
  fs.writeFileSync(ABSOLUTE_SCHEMA_PATH, schemaString);

  return {
    destination: ABSOLUTE_SCHEMA_PATH,
    schema,
  };
}
