/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import {
  ServerRequest,
  ServerResponse,
  handleNonPostRequest,
  runResultLoop,
} from "../src/server.js";
import { Board, RunResult } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { Writer, WriterResponse } from "../src/writer.js";
import { Response } from "express";

class MockResponse implements WriterResponse {
  written = "";

  write(chunk: unknown, _encoding?: unknown, _callback?: unknown): boolean {
    this.written += chunk as string;
    return true;
  }
}

test("runResultLoop correctly handles finite graph", async (t) => {
  const board = new Board();
  const core = board.addKit(Core);
  board
    .input({ $id: "in" })
    .wire(
      "*->",
      core
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
    t.is(response.written, '{"type":"input","data":{},"state":"0"}\n');
    t.is(
      intermediateState,
      '{"state":{"descriptor":{"id":"in","type":"input"},"inputs":{},"missingInputs":[],"opportunities":[],"newOpportunities":[{"from":"in","to":"noop","out":"*"}],"state":{"state":{"$type":"Map","value":[]},"constants":{"$type":"Map","value":[]}},"pendingOutputs":{"$type":"Map","value":[]}},"type":"input"}'
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

class MockServerRequest implements ServerRequest {
  path: string;
  method: string;
  body: string;

  constructor(method: string, path: string, body: string) {
    this.method = method;
    this.path = path;
    this.body = body;
  }
}

class MockServerResponse extends MockResponse {
  _status = 0;
  _type = "";
  _path = "";
  _send: unknown = undefined;

  status(code: number): Response {
    this._status = code;
    return this as unknown as Response;
  }

  type(type: string): Response {
    this._type = type;
    return this as unknown as Response;
  }

  sendFile(path: string): Response {
    this._path = path;
    return this as unknown as Response;
  }

  send(o: unknown): Response {
    this._send = o;
    return this as unknown as Response;
  }

  end(): void {
    return;
  }
}

test("handleNonPostRequest correctly handles non-GET requests", (t) => {
  {
    const req = new MockServerRequest("HEAD", "/", "");
    const res = new MockServerResponse();
    t.true(
      handleNonPostRequest(new Board(), req, res as unknown as ServerResponse)
    );
    t.is(res._status, 405);
    t.is(res._send, "Method not allowed");
  }
  {
    const req = new MockServerRequest("GET", "/", "");
    const res = new MockServerResponse();
    t.true(
      handleNonPostRequest(new Board(), req, res as unknown as ServerResponse)
    );
    t.true(res._path.endsWith("/index.html"));
  }
  {
    const req = new MockServerRequest("POST", "/", "");
    const res = new MockServerResponse();
    t.false(
      handleNonPostRequest(new Board(), req, res as unknown as ServerResponse)
    );
  }
});
