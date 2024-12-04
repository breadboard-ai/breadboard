/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema } from "@google-labs/breadboard";
import type { JSONSchema7 } from "json-schema";
import assert from "node:assert/strict";
import { test } from "node:test";
import { standardizeBreadboardSchema } from "../../breadboard/standardize-breadboard-schema.js";

test("removes behaviors recursively", () => {
  const input: Schema = {
    type: "object",
    behavior: ["config"],
    properties: {
      foo: {
        type: "string",
        behavior: ["code", "deprecated"],
      },
    },
  };
  const expected: JSONSchema7 = {
    type: "object",
    properties: {
      foo: {
        type: "string",
      },
    },
  };
  assert.deepEqual(standardizeBreadboardSchema(input), expected);
});
