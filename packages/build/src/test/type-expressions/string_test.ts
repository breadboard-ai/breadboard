/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { string } from "../../internal/type-system/string.js";
import {
  toJSONSchema,
  type ConvertBreadboardType,
} from "../../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/no-unused-vars */

test("no options", () => {
  const t = string({});
  // $ExpectType string
  type T = ConvertBreadboardType<typeof t>;
  assert.deepEqual(toJSONSchema(t), {
    type: "string",
  });
});

test("1 option", () => {
  const t = string({ format: "email" });
  // $ExpectType string
  type T = ConvertBreadboardType<typeof t>;
  assert.deepEqual(toJSONSchema(t), {
    type: "string",
    format: "email",
  });
});

test("all options", () => {
  const t = string({
    format: "uri",
    pattern: "^.*$",
    minLength: 2,
    maxLength: 42,
  });
  // $ExpectType string
  type T = ConvertBreadboardType<typeof t>;
  assert.deepEqual(toJSONSchema(t), {
    type: "string",
    format: "uri",
    pattern: "^.*$",
    minLength: 2,
    maxLength: 42,
  });
});
