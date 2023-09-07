/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { runResultLoop } from "../src/server.js";
import { Board, RunResult } from "@google-labs/breadboard";
import { Writer, WriterResponse } from "../src/writer.js";

class MockResponse implements WriterResponse {
  written = "";

  write(chunk: unknown, _encoding?: unknown, _callback?: unknown): boolean {
    this.written += chunk as string;
    return true;
  }
}

test("runResultLoop correctly handles finite graph", async (t) => {
  const board = new Board();
  board
    .input("in", { $id: "in" })
    .wire(
      "*->",
      board
        .passthrough({ $id: "noop" })
        .wire("*->", board.output({ $id: "out" }))
    );

  const response = new MockResponse();
  let intermediateState = "";
  let count = 0;
  const writer = new Writer(response, async (state) => {
    intermediateState = state;
    return (count++).toString();
  });

  {
    response.written = "";
    await runResultLoop(writer, board, {}, undefined);
    t.is(
      response.written,
      '{"type":"input","data":{"message":"in"},"state":"0"}\n'
    );
    t.is(
      intermediateState,
      '{"state":{"descriptor":{"id":"in","type":"input","configuration":{"message":"in"}},"inputs":{"message":"in"},"missingInputs":[],"opportunities":[],"newOpportunities":[{"from":"in","to":"noop","out":"*"}],"state":{"state":{"$type":"Map","value":[]},"constants":{"$type":"Map","value":[]}}},"type":"input"}'
    );
    t.is(count, 1);
  }

  {
    response.written = "";
    const restoredState = RunResult.load(intermediateState);
    await runResultLoop(writer, board, { text: "hello" }, restoredState);
    t.is(
      response.written,
      '{"type":"beforehandler","data":{"id":"noop","type":"passthrough"}}\n{"type":"output","data":{"text":"hello"}}\n'
    );
    t.is(count, 1);
  }
});
