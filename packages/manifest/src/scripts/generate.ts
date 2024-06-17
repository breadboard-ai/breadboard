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
import { createGenerator, type Config } from "ts-json-schema-generator";
import { fileURLToPath } from "url";
import { inspect } from "util";
import packageJson from "../../package.json" with { type: "json" };

export function ascendToPackageDir(packageName: string = "breadboard-ai") {
  let directory = import.meta.dirname;
  // let directory = process.cwd();
  while (directory !== "/") {
    const packageJsonPath = path.join(directory, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      if (packageJson.name === packageName) {
        return directory;
      }
    }
    directory = path.dirname(directory);
  }
  throw new Error("Could not find breadboard-ai directory.");
}

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

  const config: Config = {
    additionalProperties: false,
    expose: "export",
    path: filePath,
    schemaId: generateSchemaId(),
    sortProps: true,
    topRef: true,
    tsconfig: tsconfigPath,
    type: "BreadboardManifest",
  };

  const outputPath = path.resolve("bbm.schema.json");

  const schema = createGenerator(config).createSchema(config.type);

  console.log(
    inspect({ schema }, { showHidden: false, depth: null, colors: true })
  );

  const schemaString = JSON.stringify(schema, null, "\t");
  fs.writeFileSync(outputPath, schemaString);
  console.log(`Schema written to: ${outputPath}`);
}

main();
