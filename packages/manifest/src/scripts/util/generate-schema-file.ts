import fs from "fs";
import { Schema, createGenerator, type Config } from "ts-json-schema-generator";
import { DEFAULT_CONFIG } from "../generate";
import { ABSOLUTE_SCHEMA_PATH } from "./constants";
import { sortObject } from "./sort-objects";

export function generateSchemaFile(
  conf: Partial<Config> = {},
  postProcessor: (schema: Schema) => Schema = sortObject
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
