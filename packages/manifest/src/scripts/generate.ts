#!/usr/bin/env -S npx -y tsx --no-cache

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path, { dirname } from "path";
import { type Config } from "ts-json-schema-generator";
import { fileURLToPath } from "url";
import {
  ABSOLUTE_PACKAGE_ROOT
} from "./util/constants";
import { generateSchemaFile } from "./util/generate-schema-file";
import { generateSchemaId } from "./util/generate-schema-id";

function main() {
  console.log("Beginning Breadboard Manifest schema generation...");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const filePath = path.join(ABSOLUTE_PACKAGE_ROOT, "src", "index.ts");

  if (fs.existsSync(filePath)) {
    console.log(`Using file: ${filePath}`);
  } else {
    throw new Error(
      `File not found: ${JSON.stringify({ ABSOLUTE_PACKAGE_ROOT, origin: __filename, __dirname, filePath }, null, 2)}`
    );
  }

  const tsconfigPath = path.join(ABSOLUTE_PACKAGE_ROOT, "tsconfig.json");
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

export const DEFAULT_CONFIG: Partial<Config> = {
  additionalProperties: false,
  expose: "all",
  schemaId: generateSchemaId("tag"),
  sortProps: true,
  topRef: true,
  jsDoc: "extended",
};

export function isObject(v: unknown): v is Record<string, unknown> {
  return "[object Object]" === Object.prototype.toString.call(v);
}

main();
