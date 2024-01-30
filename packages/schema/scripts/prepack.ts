/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import schema from "../breadboard.schema.json";
import packageJson from "../package.json";

console.log(`current schema id: ${schema.$id}`);
console.log(`package.json version: ${packageJson.version}`);
schema.$id = `https://raw.githubusercontent.com/breadboard-ai/breadboard/@google-labs/breadboard-schema/${packageJson.version}/breadboard.schema.json`;
console.log(`updating schema id to: ${schema.$id}`);

fs.writeFileSync(
  path.join(process.cwd(), "breadboard.schema.json"),
  JSON.stringify(schema, null, 2)
);

console.log("done");
