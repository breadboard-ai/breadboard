#!/usr/bin/env -S npx -y tsx --no-cache

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Hacker News Simplified Algolia Search
 * see: https://hn.algolia.com/api
 */

import fs from "fs";
import path, { dirname } from "path";
import { Schema, createGenerator, type Config } from "ts-json-schema-generator";
import { fileURLToPath } from "url";
import { inspect } from "util";
import packageJson from "../../package.json" with { type: "json" };
import { ascendToPackageDir } from "../util/ascend-to-package-dir";

export function generateSchemaId() {
  const PACKAGE_ROOT = ascendToPackageDir(packageJson.name);
  const SCHEMA_PATH = path.relative(PACKAGE_ROOT, "bbm.schema.json");

  const GITHUB_OWNER = "breadboard-ai";
  const GITHUB_REPO = "breadboard";
  const GITHUB_REF = `@google-labs/manifest@${packageJson.version}`;

  const PACKAGE_PATH = "packages/manifest";

  const id = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_REF}/${PACKAGE_PATH}/${SCHEMA_PATH}`;
  return id;
}

function main() {
  console.log("Beginning Breadboard Manifest schema generation...");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const filePath = path.resolve(__dirname, "../index.ts");

  if (fs.existsSync(filePath)) {
    console.log(`Using file: ${filePath}`);
  } else {
    throw new Error(`File not found: ${filePath}`);
  }

  const tsconfigPath = path.resolve("tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    console.log(`Using tsconfig: ${tsconfigPath}`);
  } else {
    throw new Error(`File not found: ${tsconfigPath}`);
  }

  const baseConfig: Partial<Config> = {
    type: "BreadboardManifest",
    path: filePath,
    tsconfig: tsconfigPath,
  };

  // Running with skipTypeCheck: true is necessary to generate the initial unchecked schema file. Otherwise, the script will fail with a type error.
  generateSchemaFile({
    ...baseConfig,
    skipTypeCheck: true,
  });

  const result = generateSchemaFile(
    {
      ...baseConfig,
      skipTypeCheck: false,
    }
  );

  console.log(inspect(result, { showHidden: true, depth: null, colors: true }));
}

const DEFAULT_CONFIG: Partial<Config> = {
  additionalProperties: false,
  expose: "all",
  schemaId: generateSchemaId(),
  sortProps: true,
  topRef: true,
  jsDoc: "extended",
};

function generateSchemaFile(
  conf: Partial<Config> = {},
  postProcessor: (schema: Schema) => Schema = (schema: Schema): Schema => schema
) {
  console.debug(
    "Generating schema with config:",
    inspect(conf, { showHidden: false, depth: null, colors: true })
  );

  const mergedConfig: Config = {
    ...DEFAULT_CONFIG,
    ...conf,
  };

  const outputPath = path.resolve("bbm.schema.json");

  const schema: Schema = postProcessor(
    createGenerator(mergedConfig).createSchema(mergedConfig.type)
  );

  const schemaString = JSON.stringify(schema, null, "\t");
  fs.writeFileSync(outputPath, schemaString);

  return {
    destination: outputPath,
    schema,
  };
}

main();
