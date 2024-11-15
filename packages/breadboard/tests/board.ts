/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { Board } from "../src/board.js";
import type { GraphDescriptor, InputValues } from "../src/types.js";
import { TestKit } from "./helpers/_test-kit.js";
import breadboardSchema from "@google-labs/breadboard-schema/breadboard.schema.json" with { type: "json" };
import { invokeGraph, runGraph } from "../src/index.js";

test("correctly passes inputs and outputs to included boards", async (t) => {
  const nestedBoard = new Board();
  const nestedKit = nestedBoard.addKit(TestKit);
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedKit.noop().wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input()
    .wire(
      "hello->",
      kit
        .include({ graph: nestedBoard as GraphDescriptor } as InputValues)
        .wire("hello->", board.output())
    );

  const result = await invokeGraph(
    { graph: board },
    { hello: "world" },
    { kits: [nestedKit] }
  );
  t.deepEqual(result, { hello: "world" });
});

test("correctly passes inputs and outputs to included boards with a probe", async (t) => {
  const nestedBoard = new Board();
  const nestedKit = nestedBoard.addKit(TestKit);
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedKit.noop().wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input()
    .wire(
      "hello->",
      kit
        .include({ graph: nestedBoard as GraphDescriptor } as InputValues)
        .wire("hello->", board.output())
    );

  const result = await invokeGraph(
    { graph: board },
    { hello: "world" },
    { kits: [nestedKit] }
  );
  t.deepEqual(result, { hello: "world" });
});

test("allows pausing and resuming the board", async (t) => {
  let result;
  const board = new Board();
  const kit = board.addKit(TestKit);
  const input = board.input();
  input.wire("<-", kit.noop());
  input.wire("*->", kit.noop().wire("*->", board.output().wire("*->", input)));
  {
    for await (const stop of runGraph(
      { graph: board },
      { kits: [kit] },
      result
    )) {
      t.is(stop.type, "input");
      result = stop;
      break;
    }
  }
  {
    for await (const stop of runGraph(
      { graph: board },
      { kits: [kit] },
      result?.state
    )) {
      t.is(stop.type, "output");
      result = stop;
      break;
    }
  }
  {
    for await (const stop of runGraph(
      { graph: board },
      { kits: [kit] },
      result?.state
    )) {
      t.is(stop.type, "input");
      result = stop;
      break;
    }
  }
});

test("throws when incorrectly wiring different boards", async (t) => {
  const board = new Board();
  const board2 = new Board();
  const input = board.input();
  const output = board2.output();
  await t.throwsAsync(
    async () => {
      input.wire("foo->.", output);
    },
    { message: "Across board wires: From must be parent of to" }
  );
  await t.throwsAsync(
    async () => {
      input.wire("foo<-", output);
    },
    { message: "Across board wires: Must be constant for now" }
  );
});

test("when $error is set, all other outputs are ignored, named", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  const noop = kit.noop({ foo: 1, $error: { kind: "error" } });
  noop.wire("foo->", board.output());
  noop.wire(
    "$error->",
    // extra noop so that the above output would be used first
    kit.noop().wire("$error->", board.output())
  );
  const result = await invokeGraph(
    { graph: board },
    {},
    {
      kits: [kit],
    }
  );
  t.is(result.foo, undefined);
  t.like(result.$error, { kind: "error" });
});

test("when $error is set, all other outputs are ignored, with *", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  const noop = kit.noop({ foo: 1, $error: { kind: "error" } });
  const output = board.output();
  noop.wire("*->", output);
  noop.wire("$error->", output);
  const result = await invokeGraph({ graph: board }, {}, { kits: [kit] });
  t.is(result.foo, undefined);
  t.like(result.$error, { kind: "error" });
});

test("expect schema to be valid URI", async (t) => {
  const schemaId = breadboardSchema.$id;
  t.truthy(schemaId);
  t.regex(schemaId, /^https?:\/\//);
});

test("board contains a schema by default", async (t) => {
  const board = new Board();
  const serialized = JSON.parse(JSON.stringify(board));
  t.is(serialized.$schema, breadboardSchema.$id);
});

test("can set a custom schema", async (t) => {
  const customSchema =
    "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/schema/breadboard.schema.json";
  const board = new Board({
    $schema: customSchema,
  });
  const serialized = JSON.parse(JSON.stringify(board));
  t.is(serialized.$schema, customSchema);
});
