/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import packageJson from "../../package.json" assert { type: "json" };
import { generateSchemaId } from "./generate-schema-id.js";

const PACKAGE_ROOT = process.cwd();
const SCHEMA_PATH = path.relative(PACKAGE_ROOT, "breadboard.schema.json");

const id = generateSchemaId();

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

console.log(`current schema id: ${schema.$id}`);
console.log(`package.json version: ${packageJson.version}`);

schema.$id = id;
console.log(`updating schema id to: ${schema.$id}`);

fs.writeFileSync(SCHEMA_PATH, JSON.stringify(schema, null, 2));

console.log("done");

