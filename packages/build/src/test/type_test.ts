/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { anyOf } from "@breadboard-ai/build";
import { unsafeType } from "@breadboard-ai/build";
import { object } from "@breadboard-ai/build";

import {
  toJSONSchema,
  type BreadboardType,
  type ConvertBreadboardType,
} from "../internal/type-system/type.js";

import { test } from "node:test";
import assert from "node:assert/strict";

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

test("anyOf", () => {
  /* eslint-disable @typescript-eslint/no-unused-vars */

  // @ts-expect-error no arguments
  anyOf();
  // @ts-expect-error only one argument
  anyOf("number");
  // @ts-expect-error not a valid type
  assert.throws(() => anyOf(undefined));
  // @ts-expect-error not a valid type
  anyOf("xnumber", "xstring");

  const with2 = anyOf("number", "boolean") satisfies BreadboardType;
  // $ExpectType number | boolean
  type t2 = ConvertBreadboardType<typeof with2>;
  assert.deepEqual(toJSONSchema(with2), {
    anyOf: [{ type: "number" }, { type: "boolean" }],
  });

  const with3 = anyOf("number", "boolean", "string") satisfies BreadboardType;
  // $ExpectType string | number | boolean
  type t3 = ConvertBreadboardType<typeof with3>;
  assert.deepEqual(toJSONSchema(with3), {
    anyOf: [{ type: "number" }, { type: "boolean" }, { type: "string" }],
  });

  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("object", () => {
  /* eslint-disable @typescript-eslint/no-unused-vars */

  // @ts-expect-error no arguments
  assert.throws(() => object());

  const obj1 = object({});
  // $ExpectType {}
  type t1 = ConvertBreadboardType<typeof obj1>;
  assert.deepEqual(toJSONSchema(obj1), {
    type: "object",
    properties: {},
    required: [],
  });

  const obj2 = object({ foo: "string", bar: "number" });
  // $ExpectType { foo: string; bar: number; }
  type t2 = ConvertBreadboardType<typeof obj2>;
  assert.deepEqual(toJSONSchema(obj2), {
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
  });

  const obj3 = object({ foo: object({ bar: "string" }) });
  // $ExpectType { foo: { bar: string; }; }
  type t3 = ConvertBreadboardType<typeof obj3>;
  assert.deepEqual(toJSONSchema(obj3), {
    type: "object",
    properties: {
      foo: {
        type: "object",
        properties: {
          bar: {
            type: "string",
          },
        },
        required: ["bar"],
      },
    },
    required: ["foo"],
  });

  const obj4 = object({ foo: anyOf("string", "number") });
  // $ExpectType { foo: string | number; }
  type t4 = ConvertBreadboardType<typeof obj4>;
  assert.deepEqual(toJSONSchema(obj4), {
    type: "object",
    properties: {
      foo: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
    required: ["foo"],
  });

  const obj5 = object({ foo: anyOf("string", object({ bar: "string" })) });
  // $ExpectType { foo: string | { bar: string; }; }
  type t5 = ConvertBreadboardType<typeof obj5>;
  assert.deepEqual(toJSONSchema(obj5), {
    type: "object",
    properties: {
      foo: {
        anyOf: [
          { type: "string" },
          {
            type: "object",
            properties: { bar: { type: "string" } },
            required: ["bar"],
          },
        ],
      },
    },
    required: ["foo"],
  });

  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("unsafeType", () => {
  // @ts-expect-error no JSON schema
  unsafeType();
  // @ts-expect-error invalid JSON schema
  unsafeType(undefined);
  // @ts-expect-error invalid JSON schema
  unsafeType("string");

  // $ExpectType AdvancedBreadboardType<string>
  const str = unsafeType<string>({ type: "string" }) satisfies BreadboardType;
  assert.deepEqual(toJSONSchema(str), {
    type: "string",
  });

  // $ExpectType AdvancedBreadboardType<string | number>
  const strOrNum = unsafeType<string | number>({
    anyOf: [{ type: "string" }, { type: "number" }],
  }) satisfies BreadboardType;
  assert.deepEqual(toJSONSchema(strOrNum), {
    anyOf: [{ type: "string" }, { type: "number" }],
  });
});
