/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { InputSchemaReader } from "../src/bubble.js";

test("InputSchemaReader works as expected", async (t) => {
  {
    const requester = new InputSchemaReader(
      {},
      {
        schema: {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "number" },
          },
          required: ["a"],
        },
      }
    );
    const inputs: unknown[] = [];
    const result = await requester.read(async (name, schema, required) => {
      inputs.push({ name, schema, required });
      return name;
    });
    t.deepEqual(inputs, [
      { name: "a", schema: { type: "string" }, required: true },
      { name: "b", schema: { type: "number" }, required: false },
    ]);
    t.deepEqual(result, { a: "a", b: "b" });
  }
  {
    const requester = new InputSchemaReader({}, {});
    const inputs: unknown[] = [];
    const result = await requester.read(async (name, schema, required) => {
      inputs.push({ name, schema, required });
      return name;
    });
    t.deepEqual(inputs, []);
    t.deepEqual(result, {});
  }
  {
    const requester = new InputSchemaReader({}, { schema: {} });
    const inputs: unknown[] = [];
    const result = await requester.read(async (name, schema, required) => {
      inputs.push({ name, schema, required });
      return name;
    });
    t.deepEqual(inputs, []);
    t.deepEqual(result, {});
  }
  {
    const requester = new InputSchemaReader(
      {},
      {
        schema: {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "number" },
          },
        },
      }
    );
    const inputs: unknown[] = [];
    const result = await requester.read(async (name, schema, required) => {
      inputs.push({ name, schema, required });
      return name;
    });
    t.deepEqual(inputs, [
      { name: "a", schema: { type: "string" }, required: false },
      { name: "b", schema: { type: "number" }, required: false },
    ]);
    t.deepEqual(result, { a: "a", b: "b" });
  }
});

test("InputSchemaReader correctly handles existing outputs", async (t) => {
  {
    const requester = new InputSchemaReader(
      { a: "existingA" },
      {
        schema: {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "number" },
          },
        },
      }
    );
    const inputs: unknown[] = [];
    const result = await requester.read(async (name, schema, required) => {
      inputs.push({ name, schema, required });
      return name;
    });
    t.deepEqual(inputs, [
      { name: "b", schema: { type: "number" }, required: false },
    ]);
    t.deepEqual(result, { a: "existingA", b: "b" });
  }
  {
    const requester = new InputSchemaReader(
      { a: "existingA", c: "existingC" },
      {
        schema: {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "number" },
          },
          required: ["a"],
        },
      }
    );
    const inputs: unknown[] = [];
    const result = await requester.read(async (name, schema, required) => {
      inputs.push({ name, schema, required });
      return name;
    });
    t.deepEqual(inputs, [
      { name: "b", schema: { type: "number" }, required: false },
    ]);
    t.deepEqual(result, { a: "existingA", b: "b", c: "existingC" });
  }
  {
    const requester = new InputSchemaReader(
      { a: "existingA", c: "existingC" },
      {}
    );
    const inputs: unknown[] = [];
    const result = await requester.read(async (name, schema, required) => {
      inputs.push({ name, schema, required });
      return name;
    });
    t.deepEqual(inputs, []);
    t.deepEqual(result, { a: "existingA", c: "existingC" });
  }
  {
    const requester = new InputSchemaReader(
      { a: "existingA", c: "existingC" },
      { schema: {} }
    );
    const inputs: unknown[] = [];
    const result = await requester.read(async (name, schema, required) => {
      inputs.push({ name, schema, required });
      return name;
    });
    t.deepEqual(inputs, []);
    t.deepEqual(result, { a: "existingA", c: "existingC" });
  }
});
