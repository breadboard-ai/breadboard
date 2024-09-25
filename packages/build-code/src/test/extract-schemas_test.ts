/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { extractSchemas } from "../generate.js";
import { testDataDir } from "./test-data-dir.js";

test("breadboard type expression", async () => {
  const actual = await extractSchemas(
    join(testDataDir, "breadboard-type-expression.ts"),
    join(testDataDir, "tsconfig.json")
  );
  const expected = {
    inputSchema: {
      type: "object",
      properties: {
        strArr: { type: "array", items: { type: "string" } },
      },
      required: ["strArr"],
    },
    outputSchema: {
      type: "object",
      properties: {
        strArr: { type: "array", items: { type: "string" } },
      },
      required: ["strArr"],
    },
  };
  assert.deepEqual(actual, expected);
});

test("type in other file", async () => {
  const actual = await extractSchemas(
    join(testDataDir, "type-in-other-file.ts"),
    join(testDataDir, "tsconfig.json")
  );
  const expected = {
    inputSchema: {
      type: "object",
      properties: {
        boolArr: { type: "array", items: { type: "boolean" } },
      },
      required: ["boolArr"],
    },
    outputSchema: {
      type: "object",
      properties: {
        boolArr: { type: "array", items: { type: "boolean" } },
      },
      required: ["boolArr"],
    },
  };
  assert.deepEqual(actual, expected);
});
