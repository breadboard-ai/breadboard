/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { type ValidateFunction } from "ajv";
import * as fs from "fs";
import * as assert from "node:assert";
import test from "node:test";
import * as path from "path";
import { ascendToPackageDir } from "../scripts/util/ascend-to-package-dir.js";
import { getBoardFiles } from "./util/get-board-files.js";

let ajv = new Ajv();
let validate: ValidateFunction;

import schema from "../../breadboard.schema.json" assert { type: "json" };

test.before(() => {
  validate = ajv.compile(schema);
});

test("Schema is valid.", async () => {
  assert.ok(validate);
});

const packageRoot = ascendToPackageDir();
const allBoardFiles = getBoardFiles(packageRoot);

for (const file of allBoardFiles) {
  const relativePath = path.relative(packageRoot, file);
  test(`Validating ${relativePath}`, async () => {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    const valid = validate(data);
    assert.ok(valid);
  });
}
