/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { defineNodeType } from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";

test("can return $error as {message}", async () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => ({ $error: { message: "oh no" } }),
  });
  assert.deepEqual(await def.invoke({}, null as never), {
    $error: { message: "oh no" },
  });
});

test("can return $error as string and it gets normalized", async () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => ({ $error: "oh no" }),
  });
  assert.deepEqual(await def.invoke({}, null as never), {
    $error: { message: "oh no" },
  });
});

test("throwing returns an $error without leaking internal stack", async () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => {
      throw new Error("private internal details the user shouldn't see");
    },
  });
  assert.deepEqual(await def.invoke({}, null as never), {
    $error: { message: "Internal error (see server logs for details)" },
  });
});

test("must include message in $error object", () => {
  defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    // @ts-expect-error
    invoke: () => ({ $error: { notmessage: "oh no" } }),
  });
});

test("can't return other properties when returning $error", () => {
  defineNodeType({
    name: "test",
    inputs: {},
    outputs: {
      foo: { type: "number" },
    },
    // @ts-expect-error
    invoke: () => ({
      $error: "oh no",
      foo: 123,
    }),
  });
});

test("nodes that return $error have an $error output", () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => ({ $error: "oh no" }),
  });
  const inst = def({});
  assert.ok(
    // $ExpectType OutputPort<{ message: string; }>
    inst.outputs.$error
  );
});

test("all nodes have an $error output even if they don't return $error", () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => ({}),
  });
  const inst = def({});
  assert.ok(
    // $ExpectType OutputPort<{ message: string; }>
    inst.outputs.$error
  );
});
