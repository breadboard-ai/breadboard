/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from "node:test";
import { input } from "../internal/board/input.js";
import { constant } from "../internal/board/constant.js";
import { enumeration } from "../internal/type-system/enumeration.js";
import { anyOf } from "../internal/type-system/any-of.js";
import { array } from "../internal/type-system/array.js";
import { object } from "../internal/type-system/object.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

test("constant preserves types", () => {
  // $ExpectType Input<string>
  constant(input());
  // $ExpectType Input<"foo" | "bar">
  constant(input({ type: enumeration("foo", "bar") }));
  // $ExpectType InputWithDefault<number | { [x: string]: boolean; foo: number; }[]>
  constant(
    input({
      type: anyOf("number", array(object({ foo: "number" }, "boolean"))),
      default: 32,
    })
  );
});
