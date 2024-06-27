/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "ajv";
import assert from "node:assert";
import test, { describe } from "node:test";
import {
  objectToSchema,
  objectToSchemaCode,
} from "../src/nodes/object-to-schema.js";

describe("objectToSchema", () => {
  test("should convert an array to a schema", () => {
    const obj = [1, 2, 3];
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = {
      type: "array",
      items: { type: "number" },
    };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert an array of objects to a schema", () => {
    const obj = [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
    ];
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      },
    };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert an array of arrays to a schema", () => {
    const obj = [
      [1, 2],
      [3, 4],
    ];
    const schema: Schema = objectToSchema(obj);
    const expected: Schema = {
      type: "array",
      items: {
        type: "array",
        items: {
          type: "number",
        },
      },
    };
    assert.deepStrictEqual(schema, expected);
  });

  test("should convert an empty array to a schema", () => {
    const obj: [] = [];
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = { type: "array" };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert an array of mixed types to a schema", () => {
    const obj: (string | boolean | number)[] = [1, "Hello, world!", true];
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = {
      type: "array",
    };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert an object to a schema", () => {
    const obj = { name: "John", age: 30 };
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert a primitive value to a schema", () => {
    const obj = "Hello, world!";
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = { type: "string" };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert a null value to a schema", () => {
    const obj = null;
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = { type: "null" };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert an undefined value to a schema", () => {
    const obj = undefined;
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = {};
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert a boolean value to a schema", () => {
    const obj = true;
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = { type: "boolean" };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert a number value to a schema", () => {
    const obj = 42;
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = { type: "number" };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert an object with no properties to a schema", () => {
    const obj = {};
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = { type: "object", properties: {} };
    assert.deepStrictEqual(actual, expected);
  });

  test("should convert an instance of a class to a schema", () => {
    class Person {
      constructor(
        public name: string,
        public age: number
      ) {}
    }

    const obj = new Person("John", 30);
    const actual: Schema = objectToSchema(obj);
    const expected: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };
    assert.deepStrictEqual(actual, expected);
  });
  test("code node executes as expected", async () => {
    const input = { name: "John", age: 30 };
    const result = (await objectToSchemaCode().invoke({
      object: input,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
    assert(result.objectSchema);
    const actual = result.objectSchema;
    const expected: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };
    assert.deepStrictEqual(actual, expected);
  });
});
