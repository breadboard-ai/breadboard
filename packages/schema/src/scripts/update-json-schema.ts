/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import packageJson from "../../package.json" assert { type: "json" };

const PACKAGE_ROOT = process.cwd();
const SCHEMA_PATH = path.relative(PACKAGE_ROOT, "breadboard.schema.json");

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

console.log(`current schema id: ${schema.$id}`);
console.log(`package.json version: ${packageJson.version}`);

const GITHUB_OWNER = "breadboard-ai";
const GITHUB_REPO = "breadboard";
const GITHUB_REF = `@google-labs/breadboard-schema@${packageJson.version}`;

const PACKAGE_PATH = "packages/schema";

schema.$id = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_REF}/${PACKAGE_PATH}/${SCHEMA_PATH}`;
console.log(`updating schema id to: ${schema.$id}`);

fs.writeFileSync(SCHEMA_PATH, JSON.stringify(schema, null, 2));

console.log("done");
