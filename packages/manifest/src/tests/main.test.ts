/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import * as assert from "node:assert";
import test from "node:test";
import schema from "../../bbm.schema.json" with { type: "json" };
import { BreadboardManifest } from "../types";

const ajv = new Ajv({
  // keywords: definitions({
  //   // defaultMeta: "draft-07",
  // }),
  validateSchema: true,
  validateFormats: true,
  strictTypes: true,
  strict: true,
  formats: {
    // "uri-reference": require("ajv-formats/dist/formats").fullFormats["uri-reference"],
  },
  verbose: true,
  allErrors: true,
});
addFormats(ajv);

let validate: ValidateFunction;

test.before(() => {
  validate = ajv.compile(schema);
});

test("Schema is valid.", async () => {
  assert.ok(validate);
});

const fixtures: BreadboardManifest[] = [
  {},
  { title: "Empty manifest" },
  { title: "Manifest with an empty boards array", boards: [] },
  { title: "Manifest with an empty manifests array", manifests: [] },
  {
    title: "Manifest with empty boards and manifests arrays",
    boards: [],
    manifests: [],
  },
  {
    title: "Manifest with boards",
    boards: [
      {
        title: "My First Board",
        url: "htstps:////gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
        version: "1.0.0",
      },
      {
        title: "My Second Board",
        url: "./boards/board.bgl.json",
      },
    ],
  },
  {
    title: "Manifest with manifests",
    manifests: [
      {
        title: "Gist Manifest",
        url: "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
    ],
  },
  {
    title: "Manifest with boards and manifests",
    boards: [
      {
        title: "My First Board",
        url: "htstps:////gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
        version: "1.0.0",
      },
      {
        title: "My Second Board",
        url: "./boards/board.bgl.json",
      },
    ],
    manifests: [
      {
        title: "Gist Manifest",
        url: "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
    ],
  },
];

for (const manifest of fixtures) {
  const index = fixtures.indexOf(manifest);
  test(
    [`Manifest ${index + 1}/${fixtures.length}`, manifest.title]
      .filter(Boolean)
      .join(": "),
    async () => {
      const valid = validate(manifest);
      assert.ok(valid);
    }
  );
  console.debug();
}
