/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import test, { describe } from "node:test";
import { convert } from "../src/nodes/schemish.js";

describe("schemish", () => {
  test("converts a simple schema", (t) => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the person." },
      },
    };
    const result = convert(schema);
    deepStrictEqual(result, { name: "string, The name of the person." });
  });

  test("converts a schema with strings and numbers", (t) => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the person." },
        age: { type: "number", description: "The age of the person." },
      },
    };
    const result = convert(schema);
    deepStrictEqual(result, {
      name: "string, The name of the person.",
      age: "number, The age of the person.",
    });
  });

  test("converts a schema with nested objects", (t) => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the person." },
        age: { type: "number", description: "The age of the person." },
        address: {
          type: "object",
          properties: {
            street: { type: "string", description: "The street address." },
            city: { type: "string", description: "The city address." },
          },
        },
      },
    };
    const result = convert(schema);
    deepStrictEqual(result, {
      name: "string, The name of the person.",
      age: "number, The age of the person.",
      address: {
        street: "string, The street address.",
        city: "string, The city address.",
      },
    });
  });

  test("converts a schema with arrays", (t) => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the person." },
        age: { type: "number", description: "The age of the person." },
        favoriteNumbers: {
          type: "array",
          items: { type: "number", description: "A favorite number." },
        },
      },
    };
    const result = convert(schema);
    deepStrictEqual(result, {
      name: "string, The name of the person.",
      age: "number, The age of the person.",
      favoriteNumbers: ["number, A favorite number."],
    });
  });

  test("converts a schema with enums", (t) => {
    const schema = {
      type: "string",
      description: "The type of order.",
      enum: ["drink", "food"],
    };
    const result = convert(schema);
    deepStrictEqual(
      result,
      `string, The type of order. (one of: "drink", "food")`
    );
  });

  test("can handle an empty schema", (t) => {
    const schema = {};
    const result = convert(schema);
    deepStrictEqual(result, "Any JSON object");
  });
});
