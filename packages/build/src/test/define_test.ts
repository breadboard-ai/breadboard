/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";

test("placeholder test", () => {
  // $ExpectType void
  defineNodeType();
  assert.equal(typeof defineNodeType, "function");
});
