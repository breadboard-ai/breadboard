/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  anyOf,
  array,
  object,
  optional,
  unsafeType,
} from "@breadboard-ai/build";

import {
  toJSONSchema,
  type BreadboardType,
  type ConvertBreadboardType,
} from "../internal/type-system/type.js";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

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

test("anyOf", () => {
  /* eslint-disable @typescript-eslint/no-unused-vars */

  // @ts-expect-error no arguments
  anyOf();
  // @ts-expect-error only one argument
  anyOf("number");
  // @ts-expect-error not a valid type
  assert.throws(() => anyOf(undefined));
  // @ts-expect-error not a valid type
  assert.throws(() => anyOf("xnumber", "xstring"));

  const with2 = anyOf("number", "boolean") satisfies BreadboardType;
  // $ExpectType number | boolean
  type t2 = ConvertBreadboardType<typeof with2>;
  assert.deepEqual(toJSONSchema(with2), {
    type: ["number", "boolean"],
  });

  const with3 = anyOf("number", "boolean", "string") satisfies BreadboardType;
  // $ExpectType string | number | boolean
  type t3 = ConvertBreadboardType<typeof with3>;
  assert.deepEqual(toJSONSchema(with3), {
    type: ["number", "boolean", "string"],
  });

  /* eslint-enable @typescript-eslint/no-unused-vars */
});

describe("object", () => {
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

describe("array", () => {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  test("no arguments", () => {
    // @ts-expect-error no arguments
    assert.throws(() => array());
  });

  test("array of numbers", () => {
    const arr = array("number");
    // $ExpectType number[]
    type arrayType = ConvertBreadboardType<typeof arr>;
    assert.deepEqual(toJSONSchema(arr), {
      type: "array",
      items: { type: "number" },
    });
  });

  test("array of objects", () => {
    const arr = array(object({ foo: "string" }));
    // $ExpectType { foo: string; }[]
    type arrayType = ConvertBreadboardType<typeof arr>;
    assert.deepEqual(toJSONSchema(arr), {
      type: "array",
      items: {
        type: "object",
        properties: { foo: { type: "string" } },
        required: ["foo"],
        additionalProperties: false,
      },
    });
  });

  test("array of anyOf types", () => {
    const arr = array(anyOf("string", "number"));
    // $ExpectType (string | number)[]
    type arrayType = ConvertBreadboardType<typeof arr>;
    assert.deepEqual(toJSONSchema(arr), {
      type: "array",
      items: { type: ["string", "number"] },
    });
  });

  test("array of unknown", () => {
    const arr = array("unknown");
    // $ExpectType JsonSerializable[]
    type arrayType = ConvertBreadboardType<typeof arr>;
    assert.deepEqual(toJSONSchema(arr), {
      items: {
        type: ["array", "boolean", "null", "number", "object", "string"],
      },
      type: "array",
    });
  });
  /* eslint-enable @typescript-eslint/no-unused-vars */
});
