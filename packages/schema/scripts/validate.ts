/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import schema from "../breadboard.schema.json";
import testData from "./data/board.json";

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

console.log("\x1b[32m", "Successfully read schema", "\x1b[0m");

const validate = ajv.compile(schema);
console.log("\x1b[32m", "Successfully compiled schema", "\x1b[0m");

console.log("Validating test data...");

const valid = validate(testData);

if (valid) {
  console.log("\x1b[32m", "Schema is valid.", "\x1b[0m");
} else {
  console.error("\x1b[31m", "Schema is invalid:", "\x1b[0m");
  console.error(validate.errors);
}
