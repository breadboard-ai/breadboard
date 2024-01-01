/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  InputSchemaReader,
  createBubbleHandler,
  createErrorMessage,
} from "../src/bubble.js";
import { BreadboardRunner, NodeHandlerContext } from "../src/types.js";
import { Board } from "../src/board.js";
import { TestKit } from "./helpers/_test-kit.js";

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

test("createErrorMessage makes sensible messages", (t) => {
  t.deepEqual(
    createErrorMessage("foo", {}, true),
    'Missing required input "foo".'
  );
  t.deepEqual(createErrorMessage("foo", {}, false), 'Missing input "foo".');
  t.deepEqual(
    createErrorMessage("foo", { title: "Foo", url: "url goes here" }, true),
    'Missing required input "foo" for board "Foo".'
  );
  t.deepEqual(
    createErrorMessage("foo", { url: "url goes here" }, true),
    'Missing required input "foo" for board "url goes here".'
  );
  t.deepEqual(
    createErrorMessage("foo", { url: "url goes here" }, false),
    'Missing input "foo" for board "url goes here".'
  );
});

test("createBubbleHandler works as expected", async (t) => {
  {
    const handler = createBubbleHandler({}, {});
    await t.throwsAsync(
      handler("foo", { type: "string" }, true),
      undefined,
      'Missing required input "foo".'
    );
    await t.throwsAsync(
      handler("foo", { type: "string" }, false),
      undefined,
      'Missing input "foo".'
    );
    t.deepEqual(
      await handler("foo", { type: "string", default: "bar" }, false),
      "bar"
    );
  }
  {
    const handler = createBubbleHandler(
      {},
      {
        board: { title: "Foo" } as BreadboardRunner,
      }
    );
    await t.throwsAsync(
      handler("foo", { type: "string" }, true),
      undefined,
      'Missing required input "foo" for board "Foo".'
    );
  }
  {
    const handler = createBubbleHandler({}, {
      requestInput: async () => "bar",
    } satisfies NodeHandlerContext);
    t.deepEqual(await handler("foo", { type: "string" }, false), "bar");
    await t.throwsAsync(
      handler("foo", { type: "string" }, true),
      undefined,
      'Missing required input "foo".'
    );
  }
  {
    const handler = createBubbleHandler({}, {});
    t.deepEqual(
      await handler("foo", { type: "string", default: "bar" }, false),
      "bar"
    );
    t.deepEqual(
      await handler("foo", { type: "boolean", default: "false" }, false),
      false
    );
    t.deepEqual(
      await handler("foo", { type: "array", default: "[]" }, false),
      []
    );
    t.deepEqual(
      await handler(
        "foo",
        { type: "object", default: '{ "foo": "bar" }' },
        false
      ),
      { foo: "bar" }
    );
  }
});

test("inputs from 'secret' node are labeled as secrets", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input()
    .wire("*", kit.secret({ keys: ["secret"] }).wire("*", board.output()));

  const iterator = board.run();
  {
    const result = await iterator.next();
    t.is(result.value.secret, false);
    t.is(result.value.type, "input");
  }
  {
    const result = await iterator.next();
    t.is(result.value.secret, true);
    t.is(result.value.type, "input");
    result.value.inputs = { secret: "foo" };
  }
  {
    const result = await iterator.next();
    t.is(result.value.secret, false);
    t.is(result.value.type, "output");
    t.deepEqual(result.value.outputs, { secret: "foo" });
  }

  {
    const value = await board.runOnce({ secret: "bar" });
    t.deepEqual(value, { secret: "bar" });
  }

  {
    const value = await board.runOnce(
      { secret: "baz" },
      {
        requestInput: async (key, schema) => {
          t.is(key, "secret");
          t.is(schema.format, "password");
          return "qux";
        },
      }
    );
    t.deepEqual(value, { secret: "baz" });
  }

  {
    const value = await board.runOnce(
      {},
      {
        requestInput: async (key, schema) => {
          t.is(key, "secret");
          t.is(schema.format, "password");
          return "qux";
        },
      }
    );
    t.deepEqual(value, { secret: "qux" });
  }
});
