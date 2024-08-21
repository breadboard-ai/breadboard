/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { anyOf, object, optional } from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  toJSONSchema,
  type ConvertBreadboardType,
} from "../../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/no-unused-vars */

test("no arguments", () => {
  // @ts-expect-error no arguments
  assert.throws(() => object());
});

test("empty object", () => {
  const obj1 = object({});
  // $ExpectType object & JsonSerializable
  type t1 = ConvertBreadboardType<typeof obj1>;
  assert.deepEqual(toJSONSchema(obj1), {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  });
});

test("object with string and number properties", () => {
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
    additionalProperties: false,
  });
});

test("object with nested object", () => {
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
        additionalProperties: false,
      },
    },
    required: ["foo"],
    additionalProperties: false,
  });
});

test("object with anyOf type", () => {
  const obj4 = object({ foo: anyOf("string", "number") });
  // $ExpectType { foo: string | number; }
  type t4 = ConvertBreadboardType<typeof obj4>;
  assert.deepEqual(toJSONSchema(obj4), {
    type: "object",
    properties: {
      foo: { type: ["string", "number"] },
    },
    required: ["foo"],
    additionalProperties: false,
  });
});

test("object with anyOf type including object", () => {
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
            additionalProperties: false,
          },
        ],
      },
    },
    required: ["foo"],
    additionalProperties: false,
  });
});

test("object with unknown property", () => {
  const obj = object({ foo: "unknown" });
  // $ExpectType { foo: JsonSerializable; }
  type objType = ConvertBreadboardType<typeof obj>;
  assert.deepEqual(toJSONSchema(obj), {
    type: "object",
    properties: {
      foo: {
        type: ["array", "boolean", "null", "number", "object", "string"],
      },
    },
    required: ["foo"],
    additionalProperties: false,
  });
});

test("object no known properties", () => {
  const obj = object({});
  // $ExpectType object & JsonSerializable
  type objType = ConvertBreadboardType<typeof obj>;
  assert.deepEqual(toJSONSchema(obj), {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  });
});

test("empty object with additional string properties", () => {
  const obj = object({}, "string");
  // $ExpectType { [x: string]: string; }
  type objType = ConvertBreadboardType<typeof obj>;
  assert.deepEqual(toJSONSchema(obj), {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: { type: "string" },
  });
});

test("non-empty object with additional string|number properties", () => {
  const obj = object({ foo: "string" }, anyOf("string", "number"));
  // $ExpectType { [x: string]: string | number; foo: string; }
  type objType = ConvertBreadboardType<typeof obj>;
  assert.deepEqual(toJSONSchema(obj), {
    type: "object",
    properties: {
      foo: {
        type: "string",
      },
    },
    required: ["foo"],
    additionalProperties: { type: ["string", "number"] },
  });
});

test("empty object with additional unknown properties", () => {
  const obj = object({}, "unknown");
  // $ExpectType { [x: string]: JsonSerializable; }
  type objType = ConvertBreadboardType<typeof obj>;
  assert.deepEqual(toJSONSchema(obj), {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: true,
  });
});

test("object with optional property", () => {
  const obj = object({
    req: "number",
    opt: optional("number"),
  });
  // $ExpectType { req: number; opt?: number | undefined; }
  type objType = ConvertBreadboardType<typeof obj>;
  assert.deepEqual(toJSONSchema(obj), {
    type: "object",
    properties: {
      opt: { type: "number" },
      req: { type: "number" },
    },
    required: ["req"],
    additionalProperties: false,
  });
});
