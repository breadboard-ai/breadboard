/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, GraphDescriptor } from "@google-labs/breadboard";
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import * as assert from "node:assert";
import test, { describe } from "node:test";
import { BreadboardManifest } from "..";
import { ABSOLUTE_SCHEMA_PATH } from "../scripts/util/constants";

const ajv: Ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictTypes: true,
  validateFormats: true,
  validateSchema: true,
  verbose: true,
  loadSchema: async (uri: string) => {
    const response = await fetch(uri);
    if (response.ok) {
      const json = await response.json();
      if (ajv.validateSchema(json)) {
        return json;
      }
    }
    throw new Error(`Loading error: ${response.status}`);
  },
});

addFormats(ajv);

const readSchemaFile = fs.readFileSync(ABSOLUTE_SCHEMA_PATH, "utf-8");
const parsedSchema = JSON.parse(readSchemaFile);
const validate = await ajv.compileAsync(parsedSchema);

const manifestArray: BreadboardManifest[] = [
  {},
  { title: "Empty manifest" },
  { title: "Manifest with an empty boards array", boards: [] },
  { title: "Manifest with an empty manifests array", manifests: [] },
  {
    title: "Manifest with a hard-coded board",
    boards: [
      {
        edges: [
          {
            from: "input-1",
            to: "output-2",
            out: "*",
            in: "",
          },
        ],
        nodes: [
          {
            id: "output-2",
            type: "output",
            configuration: {},
          },
          {
            id: "input-1",
            type: "input",
            configuration: {},
          },
        ],
      },
    ],
  },
  {
    title: "Manifest with a generated board",
    boards: [
      (await base.input().to(base.output()).serialize({})) as GraphDescriptor,
    ],
  },
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
      },
      {
        title: "My Second Board",
        reference: "./boards/board.bgl.json",
      },
    ],
  },
  {
    title: "Manifest with tags",
    boards: [
      {
        title: "My Second Board",
        reference: "./boards/board.bgl.json",
        tags: ["tool"],
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
