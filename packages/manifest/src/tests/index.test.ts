/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import * as assert from "node:assert";
import test, { describe } from "node:test";
import { BreadboardManifest } from "..";
import schema from "../../bbm.schema.json" with { type: "json" };

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

const manifestArray: BreadboardManifest[] = [
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
        reference:
          "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
        version: "1.0.0",
      },
      {
        title: "My Second Board",
        reference: "./boards/board.bgl.json",
      },
    ],
  },
  {
    title: "Manifest with manifests",
    manifests: [
      {
        title: "Gist Manifest",
        reference:
          "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
    ],
  },
  {
    title: "Manifest with boards and manifests",
    boards: [
      {
        title: "My First Board",
        reference:
          "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
        version: "1.0.0",
      },
      {
        title: "My Second Board",
        reference: "./boards/board.bgl.json",
      },
    ],
    manifests: [
      {
        title: "Gist Manifest",
        reference:
          "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
    ],
  },
  {
    title: "Nested manifest",
    manifests: [
      {
        title: "Gist Manifest",
        reference:
          "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
      {
        title: "Nested Nested Manifest",
        boards: [
          {
            title: "My First Board",
            reference:
              "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
            version: "1.0.0",
          },
        ],
        manifests: [
          {
            title: "Nested Nested Nested Manifest",
            boards: [
              {
                title: "My First Board",
                reference:
                  "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
                version: "1.0.0",
              },
            ],
          },
        ],
      },
    ],
  },
];

describe("Schema Tests", () => {
  test("Schema is valid.", async () => {
    assert.ok(validate);
  });
  describe("Validation Tests", () => {
    manifestArray.forEach((manifest, index) => {
      test(`Manifest ${index + 1}/${manifestArray.length}: ${manifest.title || ""}`, async () => {
        const valid = validate(manifest);
        const errors = validate.errors;
        if (errors) {
          throw new Error(`errors: ${JSON.stringify(errors, null, 2)}`);
        }
        assert.ok(!errors);
        assert.ok(valid);
      });
    });
  });
});

function writeManifestJson() {
  fs.writeFileSync(
    "./manifest.bbm.json",
    JSON.stringify(
      {
        $schema: "./bbm.schema.json",
        title: "Manifest with boards and manifests",
        manifests: manifestArray,
      },
      null,
      2
    )
  );
}
