/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { RunResult, replacer, reviver } from "../src/run.js";
import { Board } from "../src/board.js";

test("replacer correctly serializes Maps", async (t) => {
  t.is(JSON.stringify({}, replacer), "{}");
  t.is(JSON.stringify("string", replacer), '"string"');
  t.is(JSON.stringify(42, replacer), "42");
  t.is(
    JSON.stringify(new Map([["foo", "bar"]]), replacer),
    '{"$type":"Map","value":[["foo","bar"]]}'
  );
  t.is(
    JSON.stringify(new Map([["foo", new Map([["bar", "baz"]])]]), replacer),
    '{"$type":"Map","value":[["foo",{"$type":"Map","value":[["bar","baz"]]}]]}'
  );
});

test("reviver correctly deserializes maps", async (t) => {
  t.deepEqual(JSON.parse("{}", reviver), {});
  t.deepEqual(JSON.parse('"string"', reviver), "string");
  t.deepEqual(JSON.parse("42", reviver), 42);
  t.deepEqual(
    JSON.parse('{"$type":"Map","value":[["foo","bar"]]}', reviver),
    new Map([["foo", "bar"]])
  );
  t.deepEqual(
    JSON.parse(
      '{"$type":"Map","value":[["foo",{"$type":"Map","value":[["bar","baz"]]}]]}',
      reviver
    ),
    new Map([["foo", new Map([["bar", "baz"]])]])
  );
});

test("correctly saves and loads", async (t) => {
  let runResult = "";
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
      runResult = stop.save();
      break;
    }
  }
  {
    const secondBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of secondBoard.run(
      undefined,
      undefined,
      RunResult.load(runResult)
    )) {
      t.is(stop.type, "input");
      runResult = stop.save();
      break;
    }
  }
  {
    const thirdBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of thirdBoard.run(
      undefined,
      undefined,
      RunResult.load(runResult)
    )) {
      t.is(stop.type, "beforehandler");
      runResult = stop.save();
      break;
    }
  }
  {
    const fourthBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of fourthBoard.run(
      undefined,
      undefined,
      RunResult.load(runResult)
    )) {
      t.is(stop.type, "output");
      runResult = stop.save();
      break;
    }
  }
  {
    const fifthBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of fifthBoard.run(
      undefined,
      undefined,
      RunResult.load(runResult)
    )) {
      t.is(stop.type, "input");
      runResult = stop.save();
      break;
    }
  }
  t.regex(runResult, /"missingInputs":\[\],"opportunities":\[\]/);
});

test("correctly detects exit node", async (t) => {
  const board = new Board();
  const input = board.input();
  input.wire("*->", board.passthrough().wire("*->", board.output()));

  const generator = board.run();

  {
    const stop = await generator.next();
    t.is(stop.value.type, "input");
    t.false(stop.value.isAtExitNode());
  }

  {
    const stop = await generator.next();
    t.is(stop.value.type, "beforehandler");
    t.false(stop.value.isAtExitNode());
  }

  {
    const stop = await generator.next();
    t.is(stop.value.type, "output");
    t.true(stop.value.isAtExitNode());
  }
});
