/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  toJSONSchema,
  type BreadboardType,
  type ConvertBreadboardType,
} from "../../internal/type-system/type.js";

test("string", () => {
  "string" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xstring" satisfies BreadboardType;
  assert.deepEqual(toJSONSchema("string"), { type: "string" });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType string
  type t = ConvertBreadboardType<"string">;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("number", () => {
  "number" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xnumber" satisfies BreadboardType;
  assert.deepEqual(toJSONSchema("number"), { type: "number" });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType number
  type t = ConvertBreadboardType<"number">;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("boolean", () => {
  "boolean" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xboolean" satisfies BreadboardType;
  assert.deepEqual(toJSONSchema("boolean"), { type: "boolean" });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType boolean
  type t = ConvertBreadboardType<"boolean">;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("unknown", () => {
  "unknown" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xunknown" satisfies BreadboardType;
  assert.deepEqual(toJSONSchema("unknown"), {
    type: ["array", "boolean", "null", "number", "object", "string"],
  });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType JsonSerializable
  type t = ConvertBreadboardType<"unknown">;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});
