import { default as Ajv, type ValidateFunction } from "ajv";
import * as fs from "fs";
import * as assert from "node:assert";
import test from "node:test";
import * as path from "path";
import { ascendToPackageDir } from "./util/ascendToPackageDir.js";
import { getBoardFiles } from "./util/getBoardFiles.js";

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
