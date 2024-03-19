/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  anyOf,
  toJSONSchema,
  type BreadboardType,
  type TypeScriptTypeFromBreadboardType,
} from "../type.js";
import { test } from "node:test";
import assert from "node:assert/strict";

test("string", () => {
  "string" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xstring" satisfies BreadboardType;
  assert.deepEqual(toJSONSchema("string"), { type: "string" });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType string
  type t = TypeScriptTypeFromBreadboardType<"string">;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("number", () => {
  "number" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xnumber" satisfies BreadboardType;
  assert.deepEqual(toJSONSchema("number"), { type: "number" });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType number
  type t = TypeScriptTypeFromBreadboardType<"number">;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("boolean", () => {
  "boolean" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xboolean" satisfies BreadboardType;
  assert.deepEqual(toJSONSchema("boolean"), { type: "boolean" });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType boolean
  type t = TypeScriptTypeFromBreadboardType<"boolean">;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("anyOf", () => {
  // @ts-expect-error no arguments
  anyOf();
  // @ts-expect-error only one argument
  anyOf("number");
  // @ts-expect-error not a valid type
  anyOf(undefined);
  // @ts-expect-error not a valid type
  anyOf("xnumber", "xstring");

  const with2 = anyOf("number", "boolean") satisfies BreadboardType;
  assert.deepEqual(toJSONSchema(with2), {
    anyOf: [{ type: "number" }, { type: "boolean" }],
  });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType number | boolean
  type t2 = TypeScriptTypeFromBreadboardType<typeof with2>;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const with3 = anyOf("number", "boolean", "string") satisfies BreadboardType;
  assert.deepEqual(toJSONSchema(with3), {
    anyOf: [{ type: "number" }, { type: "boolean" }, { type: "string" }],
  });
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType string | number | boolean
  type t3 = TypeScriptTypeFromBreadboardType<typeof with3>;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});
