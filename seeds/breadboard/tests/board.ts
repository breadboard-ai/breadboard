/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { Board } from "../src/board.js";
import type { ProbeEvent } from "../src/types.js";

test("correctly skips nodes when asked", async (t) => {
  const board = new Board();
  board
    .input()
    .wire(
      "*->",
      board.passthrough({ $id: "toSkip" }).wire("*->", board.output())
    );

  const skipper = new EventTarget();
  skipper.addEventListener("beforehandler", (event) => {
    const e = event as ProbeEvent;
    if (e.detail.descriptor.id === "toSkip") {
      e.detail.outputs = { instead: "this" };
      e.preventDefault();
    }
  });

  const result = await board.runOnce({ hello: "world" }, skipper);
  t.deepEqual(result, { instead: "this" });
});

test("correctly passes inputs and outputs to included boards", async (t) => {
  const nestedBoard = new Board();
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedBoard
        .passthrough()
        .wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  board
    .input()
    .wire(
      "hello->",
      board.include(nestedBoard).wire("hello->", board.output())
    );

  const result = await board.runOnce({ hello: "world" });
  t.deepEqual(result, { hello: "world" });
});

test("correctly passes inputs and outputs to included boards with a probe", async (t) => {
  const nestedBoard = new Board();
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedBoard
        .passthrough()
        .wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  board
    .input()
    .wire(
      "hello->",
      board.include(nestedBoard).wire("hello->", board.output())
    );

  const result = await board.runOnce({ hello: "world" }, new EventTarget());
  t.deepEqual(result, { hello: "world" });
});

test("correctly skips nodes in nested boards", async (t) => {
  const nestedBoard = new Board();
  nestedBoard
    .input()
    .wire(
      "*->",
      nestedBoard
        .passthrough({ $id: "toSkip" })
        .wire("*->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  board
    .input()
    .wire("*->", board.include(nestedBoard).wire("*->", board.output()));

  const skipper = new EventTarget();
  skipper.addEventListener("beforehandler", (event) => {
    const e = event as ProbeEvent;
    if (e.detail.descriptor.id === "toSkip") {
      e.detail.outputs = { instead: "this" };
      e.preventDefault();
    }
  });

  const result = await board.runOnce({ hello: "world" }, skipper);
  t.deepEqual(result, { instead: "this" });
});

test("allows pausing and resuming the board", async (t) => {
  let result;
  const board = new Board();
  const input = board.input();
  input.wire("<-", board.passthrough());
  input.wire(
    "*->",
    board.passthrough().wire("*->", board.output().wire("*->", input))
  );
  {
    const firstBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of firstBoard.run()) {
      t.is(stop.type, "beforehandler");
      result = stop;
      break;
    }
  }
  {
    const secondBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of secondBoard.run(undefined, undefined, result)) {
      t.is(stop.type, "input");
      result = stop;
      break;
    }
  }
  {
    const thirdBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of thirdBoard.run(undefined, undefined, result)) {
      t.is(stop.type, "beforehandler");
      result = stop;
      break;
    }
  }
  {
    const fourthBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of fourthBoard.run(undefined, undefined, result)) {
      t.is(stop.type, "output");
      result = stop;
      break;
    }
  }
  {
    const fifthBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of fifthBoard.run(undefined, undefined, result)) {
      t.is(stop.type, "input");
      result = stop;
      break;
    }
  }
});
