/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { intersect } from "../../internal/type-system/intersect.js";
import { object, optional } from "../../internal/type-system/object.js";
import {
  toJSONSchema,
  type ConvertBreadboardType,
} from "../../internal/type-system/type.js";
import { array } from "../../internal/type-system/array.js";

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */

test("two disjoint closed required objects", () => {
  const intersection = intersect(
    object({ foo: "string" }),
    object({ bar: "number" })
  );
  // $ExpectType { foo: string; } & { bar: number; }
  type t = ConvertBreadboardType<typeof intersection>;
  assert.deepEqual(toJSONSchema(intersection), {
    type: "object",
    properties: {
      foo: {
        type: "string",
      },
      bar: {
        type: "number",
      },
    },
    required: ["foo", "bar"],
    additionalProperties: false,
  });
});

test("two disjoint closed optional objects", () => {
  const intersection = intersect(
    object({ foo: optional("string") }),
    object({ bar: optional("number") })
  );
  // $ExpectType { foo?: string | undefined; } & { bar?: number | undefined; }
  type t = ConvertBreadboardType<typeof intersection>;
  assert.deepEqual(toJSONSchema(intersection), {
    type: "object",
    properties: {
      foo: {
        type: "string",
      },
      bar: {
        type: "number",
      },
    },
    required: [],
    additionalProperties: false,
  });
});

test("two disjoint fully open required objects", () => {
  const intersection = intersect(
    object({ foo: "string" }, "unknown"),
    object({ bar: "number" }, "unknown")
  );
  // $ExpectType { [x: string]: JsonSerializable; foo: string; } & { [x: string]: JsonSerializable; bar: number; }
  type t = ConvertBreadboardType<typeof intersection>;
  assert.deepEqual(toJSONSchema(intersection), {
    type: "object",
    properties: {
      foo: {
        type: "string",
      },
      bar: {
        type: "number",
      },
    },
    required: ["foo", "bar"],
    additionalProperties: true,
  });
});

test("two complex nested objects", () => {
  const intersection = intersect(
    object({ foo: object({ foo2: array("number") }) }),
    object({ bar: object({ bar2: array("boolean") }) })
  );
  // $ExpectType { foo: { foo2: number[]; }; } & { bar: { bar2: boolean[]; }; }
  type t = ConvertBreadboardType<typeof intersection>;
  assert.deepEqual(toJSONSchema(intersection), {
    type: "object",
    properties: {
      bar: {
        type: "object",
        properties: {
          bar2: {
            items: {
              type: "boolean",
            },
            type: "array",
          },
        },
        required: ["bar2"],
        additionalProperties: false,
      },
      foo: {
        type: "object",
        properties: {
          foo2: {
            items: {
              type: "number",
            },
            type: "array",
          },
        },
        required: ["foo2"],
        additionalProperties: false,
      },
    },
    required: ["foo", "bar"],
    additionalProperties: false,
  });
});

test("error: no arguments", () => {
  assert.throws(
    () =>
      // @ts-expect-error
      intersect(),
    /intersect requires at least 2 arguments, got 0/
  );
});

test("error: one object", () => {
  assert.throws(
    () =>
      // @ts-expect-error
      intersect(object({ foo: "string" })),
    /intersect requires at least 2 arguments, got 1/
  );
});

test("error: not an object (number)", () => {
  assert.throws(
    // @ts-expect-error
    () => intersect(object({ foo: "string" }), "number"),
    /intersect only supports objects, got number/
  );
});

test("error: not an object (array)", () => {
  assert.throws(
    () => intersect(object({ foo: "string" }), array("number")),
    /intersect only supports objects, got array/
  );
});

test("error: overlapping properties", () => {
  assert.throws(
    () => intersect(object({ foo: "string" }), object({ foo: "number" })),
    /intersect only supports disjoint properties, got "foo" 2 or more times/
  );
});

test("error: partially open", () => {
  assert.throws(
    () =>
      intersect(
        object({ foo: "string" }, "string"),
        object({ bar: "number" }, "unknown")
      ),
    /intersect only supports closed or fully open objects, got {"additionalProperties":{"type":"string"}}/
  );
});
