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
import {
  GraphDescriptor,
  InputValues,
  NodeHandlerContext,
  Schema,
} from "../src/types.js";

test("InputSchemaReader works as expected", async (t) => {
  {
    const reader = new InputSchemaReader(
      { foo: "foo" },
      {
        schema: {
          properties: {
            foo: { type: "string" },
          },
        } satisfies Schema,
      } satisfies InputValues,
      []
    );
    const result = await reader.read(async () => {
      t.fail();
      return {};
    });
    t.deepEqual(result, { foo: "foo" });
  }
  {
    const reader = new InputSchemaReader(
      { foo: "foo", bar: "bar" },
      {
        schema: {
          properties: {
            foo: { type: "string" },
          },
        } satisfies Schema,
      } satisfies InputValues,
      []
    );
    const result = await reader.read(async () => {
      t.fail();
      return {};
    });
    t.deepEqual(result, { foo: "foo", bar: "bar" });
  }
  {
    const reader = new InputSchemaReader(
      { bar: "bar" },
      {
        schema: {
          properties: {
            foo: { type: "string" },
          },
        } satisfies Schema,
      } satisfies InputValues,
      []
    );
    const result = await reader.read(async () => {
      return { foo: "qux" };
    });
    t.deepEqual(result, { foo: "qux", bar: "bar" });
  }
  {
    const reader = new InputSchemaReader({ foo: "foo" }, {}, []);
    const result = await reader.read(async () => {
      t.fail();
      return {};
    });
    t.deepEqual(result, { foo: "foo" });
  }
  {
    const reader = new InputSchemaReader(
      {},
      {
        schema: {
          properties: {
            foo: { type: "string" },
          },
        } satisfies Schema,
      } satisfies InputValues,
      []
    );
    let called = false;
    await reader.read(async () => {
      called = true;
      return {};
    });
    t.true(called);
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
  const descriptor = { id: "id", type: "type" };
  {
    const handler = createBubbleHandler({}, {}, descriptor, []);
    await t.throwsAsync(
      handler(
        {
          properties: {
            foo: { type: "string" },
          },
          required: ["foo"],
        },
        []
      ),
      undefined,
      'Missing required input "foo".'
    );
    await t.throwsAsync(
      handler(
        {
          properties: {
            foo: { type: "string" },
          },
        },
        []
      ),
      undefined,
      'Missing input "foo".'
    );
    t.deepEqual(
      await handler(
        {
          properties: {
            foo: { type: "string", default: "bar" },
          },
        },
        []
      ),
      { foo: "bar" }
    );
  }
  {
    const handler = createBubbleHandler(
      {},
      {
        board: { title: "Foo" } as GraphDescriptor,
      },
      descriptor,
      []
    );
    await t.throwsAsync(
      handler(
        { properties: { foo: { type: "string" } }, required: ["foo"] },
        []
      ),
      undefined,
      'Missing required input "foo" for board "Foo".'
    );
  }
  {
    const handler = createBubbleHandler(
      {},
      {
        requestInput: async () => ({ foo: "bar" }),
      } satisfies NodeHandlerContext,
      descriptor,
      []
    );
    t.deepEqual(
      await handler({ properties: { foo: { type: "string" } } }, []),
      { foo: "bar" }
    );
    await t.throwsAsync(
      handler(
        { properties: { foo: { type: "string" } }, required: ["foo"] },
        []
      ),
      undefined,
      'Missing required input "foo".'
    );
  }
  {
    const handler = createBubbleHandler({}, {}, descriptor, []);
    t.deepEqual(
      await handler(
        { properties: { foo: { type: "string", default: "bar" } } },
        []
      ),
      { foo: "bar" }
    );
    t.deepEqual(
      await handler(
        { properties: { foo: { type: "boolean", default: "false" } } },
        []
      ),
      { foo: false }
    );
    t.deepEqual(
      await handler(
        { properties: { foo: { type: "array", default: "[]" } } },
        []
      ),
      { foo: [] }
    );
    t.deepEqual(
      await handler(
        {
          properties: { foo: { type: "object", default: '{ "foo": "bar" }' } },
        },
        []
      ),
      { foo: { foo: "bar" } }
    );
  }
});
