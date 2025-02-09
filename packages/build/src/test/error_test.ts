/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { defineNodeType } from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";

test("returns $error as ErrorCapability given {message}", async () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => ({ $error: { message: "oh no" } }),
  });
  assert.deepEqual(await def.invoke({}, null as never), {
    $error: { kind: "error", error: { message: "oh no" } },
  });
});

test("can return $error as ErrorCapability given string", async () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => ({ $error: "oh no" }),
  });
  assert.deepEqual(await def.invoke({}, null as never), {
    $error: { kind: "error", error: { message: "oh no" } },
  });
});

test("can return $error as ErrorCapability given ErrorCapability", async () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => ({ $error: { kind: "error", error: { message: "oh no" } } }),
  });
  assert.deepEqual(await def.invoke({}, null as never), {
    $error: { kind: "error", error: { message: "oh no" } },
  });
});

test("throwing returns an $error with Internal Exception prefix and stack trace", async () => {
  const def = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {},
    invoke: () => {
      throw new Error("internal details");
    },
  });
  const result = await def.invoke({}, null as never);
  const message = (result?.$error as { message?: string } | undefined)?.message;
  assert.match(
    message!,
    /Internal Exception: internal details\n.*error_test.ts.*/
  );
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
    // $ExpectType OutputPort<{ message: string; } | { kind: string; error: { message: string; }; }>
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
    // $ExpectType OutputPort<{ message: string; } | { kind: string; error: { message: string; }; }>
    inst.outputs.$error
  );
});

test("can't declare node with $error output because it's automatic", () => {
  assert.throws(
    () =>
      // @ts-expect-error
      defineNodeType({
        name: "test",
        inputs: {},
        outputs: {
          $error: {
            type: "string",
          },
        },
        invoke: () => ({}),
      }),
    /"\$error" cannot be used as an output port name because it is reserved/
  );
});
