/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import fs from "fs";
import path from "path";

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "breadboard.schema.json"), "utf8")
);
console.log("\x1b[32m", "Successfully read schema", "\x1b[0m");

// Validate the schema
const validate = ajv.compile(schema);
console.log("\x1b[32m", "Successfully compiled schema", "\x1b[0m");

console.log("Validating test data...");
const testData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "board.json"), "utf8")
);
const valid = validate(testData);

if (valid) {
  console.log("\x1b[32m", "Schema is valid.", "\x1b[0m");
} else {
  console.error("\x1b[31m", "Schema is invalid:", "\x1b[0m");
  console.error(validate.errors);
}
