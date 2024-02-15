/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";

const filePath = path.resolve("src/graph.ts");
console.assert(fs.existsSync(filePath), `File not found: ${filePath}`);

const tsconfigPath = path.resolve("tsconfig.json");
console.assert(fs.existsSync(tsconfigPath), `File not found: ${tsconfigPath}`);

import { createGenerator, type Config } from "ts-json-schema-generator";
import { generateSchemaId } from "./generate-schema-id.js";

const config: Config = {
  additionalProperties: false,
  expose: "all",
  path: filePath,
  schemaId: generateSchemaId(),
  sortProps: true,
  topRef: true,
  tsconfig: tsconfigPath,
  type: "GraphDescriptor",
};

const output_path = path.resolve("breadboard.schema.json");

const schema = createGenerator(config).createSchema(config.type);

const schemaString = JSON.stringify(schema, null, "\t");
fs.writeFile(output_path, schemaString, (err) => {
  if (err) throw err;
});

