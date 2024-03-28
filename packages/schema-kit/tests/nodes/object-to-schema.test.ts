import assert from "node:assert";
import { describe, test } from "node:test";
import { objectToSchema } from "../../src/index.js";

describe("objectToSchema", () => {
  test("should convert an array to a schema", () => {
    const obj = [1, 2, 3];
    const schema = objectToSchema(obj);
    assert.deepStrictEqual(schema, {
      type: "array",
      items: { type: "number" },
    });
  });

  test("should convert an object to a schema", () => {
    const obj = { name: "John", age: 30 };
    const schema = objectToSchema(obj);
    assert.deepStrictEqual(schema, {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    });
  });

  test("should convert a primitive value to a schema", () => {
    const obj = "Hello, world!";
    const schema = objectToSchema(obj);
    assert.deepStrictEqual(schema, { type: "string" });
  });

  test("should convert a null value to a schema", () => {
    const obj = null;
    const schema = objectToSchema(obj);
    assert.deepStrictEqual(schema, { type: "null" });
  });

  test("should convert an undefined value to a schema", () => {
    const obj = undefined;
    const schema = objectToSchema(obj);
    assert.deepStrictEqual(schema, {});
  });

  test("should convert a boolean value to a schema", () => {
    const obj = true;
    const schema = objectToSchema(obj);
    assert.deepStrictEqual(schema, { type: "boolean" });
  });

  test("should convert a number value to a schema", () => {
    const obj = 42;
    const schema = objectToSchema(obj);
    assert.deepStrictEqual(schema, { type: "number" });
  });

  test("should convert an object with no properties to a schema", () => {
    const obj = {};
    const schema = objectToSchema(obj);
    assert.deepStrictEqual(schema, { type: "object", properties: {} });
  });
});
