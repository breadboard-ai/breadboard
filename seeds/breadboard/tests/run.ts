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
      t.is(stop.type, "input");
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
      t.is(stop.type, "output");
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
  t.is(
    runResult,
    '{"state":{"descriptor":{"id":"input-1","type":"input"},"inputs":{},"missingInputs":[],"opportunities":[],"newOpportunities":[{"from":"input-1","to":"passthrough-3","out":"*"}],"state":{"state":{"$type":"Map","value":[["input-1",{"$type":"Map","value":[["output-4",{}]]}]]},"constants":{"$type":"Map","value":[]}}},"type":"input"}'
  );
});
