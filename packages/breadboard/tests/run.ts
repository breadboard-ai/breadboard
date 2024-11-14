/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { RunResult } from "../src/run.js";
import { Board } from "../src/board.js";
import { TestKit } from "./helpers/_test-kit.js";
import { replacer, reviver } from "../src/serialization.js";
import { runGraph } from "../src/index.js";

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
  const kit = board.addKit(TestKit);
  const input = board.input();
  input.wire("<-", kit.noop());
  input.wire("*->", kit.noop().wire("*->", board.output().wire("*->", input)));
  {
    for await (const stop of runGraph({ graph: board }, { kits: [kit] })) {
      t.is(stop.type, "input");
      runResult = stop.save();
      break;
    }
  }
  {
    for await (const stop of runGraph(
      { graph: board },
      { kits: [kit] },
      RunResult.load(runResult)?.state
    )) {
      t.is(stop.type, "output");
      runResult = stop.save();
      break;
    }
  }
  {
    for await (const stop of runGraph(
      { graph: board },
      { kits: [kit] },
      RunResult.load(runResult)?.state
    )) {
      t.is(stop.type, "input");
      runResult = stop.save();
      break;
    }
  }
  t.regex(runResult, /"missingInputs":\[\],.*"opportunities":\[\]/);
});

test("correctly detects exit node", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  const input = board.input();
  input.wire("*->", kit.noop().wire("*->", board.output()));

  const generator = runGraph({ graph: board }, { kits: [kit] });

  {
    const stop = await generator.next();
    t.is(stop.value.type, "input");
    t.false(stop.value.isAtExitNode());
  }

  {
    const stop = await generator.next();
    t.is(stop.value.type, "output");
    t.true(stop.value.isAtExitNode());
  }
});
