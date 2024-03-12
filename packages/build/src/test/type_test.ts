/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardType,
  TypeScriptTypeFromBreadboardType,
} from "../type.js";
import { test } from "node:test";

test("basic types are valid", () => {
  "string" satisfies BreadboardType;
  "number" satisfies BreadboardType;
  "boolean" satisfies BreadboardType;
});

test("basic type typos are invalid", () => {
  // @ts-expect-error not a valid basic type
  "xstring" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xnumber" satisfies BreadboardType;
  // @ts-expect-error not a valid basic type
  "xboolean" satisfies BreadboardType;
});

test("convert basic types to typescript", () => {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType string
  type s = TypeScriptTypeFromBreadboardType<"string">;
  // $ExpectType number
  type n = TypeScriptTypeFromBreadboardType<"number">;
  // $ExpectType boolean
  type b = TypeScriptTypeFromBreadboardType<"boolean">;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});
