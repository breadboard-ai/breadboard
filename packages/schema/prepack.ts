/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";

const packageJsonPath = path.join(__dirname, "package.json");
const schemaPath = path.join(__dirname, "breadboard.schema.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
console.log(`schema id: ${schema.$id}`);

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
console.log(`package.json version: ${packageJson.version}`);

schema.$id = `https://raw.githubusercontent.com/breadboard-ai/breadboard/@google-labs/breadboard-schema/${packageJson.version}/breadboard.schema.json`;

console.log(`updating schema id to: ${schema.$id}`);

fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

console.log("done");
