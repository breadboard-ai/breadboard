#!/usr/bin/env -S npx -y tsx --no-cache

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path, { dirname } from "path";
import { Schema, createGenerator, type Config } from "ts-json-schema-generator";
import { fileURLToPath } from "url";
import packageJson from "../../package.json" with { type: "json" };
import { ascendToPackageDir } from "./util/ascend-to-package-dir";

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
  const pacakgeRoot = ascendToPackageDir(packageJson.name);

  const filePath = path.join(pacakgeRoot, "src", "index.ts");

  if (fs.existsSync(filePath)) {
    console.log(`Using file: ${filePath}`);
  } else {
    throw new Error(
      `File not found: ${JSON.stringify({ pacakgeRoot, origin: __filename, __dirname, filePath }, null, 2)}`
    );
  }

  const tsconfigPath = path.join(pacakgeRoot, "tsconfig.json");
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

  const result = generateSchemaFile({
    ...baseConfig,
    skipTypeCheck: true,
  });

  console.log(JSON.stringify({ result }, null, 2));
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

  const outputPath = path.join(ascendToPackageDir(packageJson.name), "bbm.schema.json");

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

function isObject(v: unknown): v is Record<string, unknown> {
  return "[object Object]" === Object.prototype.toString.call(v);
}

function sortObject(obj: unknown): object {
  if (Array.isArray(obj)) {
    return obj.sort().map((value) => sortObject(value));
  } else if (isObject(obj)) {
    return Object.keys(obj)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = sortObject(obj[key]);
          return acc;
        },
        {} as Record<string, unknown>
      );
  } else {
    return obj as object;
  }
}

main();
