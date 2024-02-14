import Ajv, { ValidateFunction } from "ajv";
import assert from "assert/strict";
import fs from "fs";
import test from "node:test";
import path from "path";
import { ascendToPackageDir } from "./util/ascendToPackageDir";
import { getBoardFiles } from "./util/getBoardFiles";

const ajv = new Ajv();
let validate: ValidateFunction;

test.before(() => {
  const packageDir = ascendToPackageDir();
  process.chdir(packageDir);

  const schemaPath = path.resolve(
    path.join(packageDir, "packages", "schema", "breadboard.schema.json")
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
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
