/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { Writer, WriterResponse } from "../src/writer.js";
import { RunResult } from "@google-labs/breadboard";

class MockResponse implements WriterResponse {
  written = "";

  write(chunk: unknown, _encoding?: unknown, _callback?: unknown): boolean {
    this.written += chunk as string;
    return true;
  }
}

class MockEdgeState {
  state = new Map();
  constants = new Map();
  update = () => {
    return;
  };
  getAvailableOutputs = () => new Map();
}

test("writes raw response", (t) => {
  const mockResponse = new MockResponse();
  const writer = new Writer(mockResponse, async (state) => state);
  writer.write({
    type: "input",
    data: {},
    state: undefined,
  });
  t.is(mockResponse.written, '{"type":"input","data":{}}\n');
});

test("writes input", async (t) => {
  const mockResponse = new MockResponse();
  const writer = new Writer(mockResponse, async (state) => state);
  const stop = new RunResult(
    {
      descriptor: {
        id: "test",
        type: "test",
      },
      inputs: {},
      missingInputs: [],
      opportunities: [{ from: "test", to: "test", out: "*" }],
      state: new MockEdgeState(),
      outputs: {},
      skip: false,
      newOpportunities: [],
    },
    "input"
  );
  await writer.writeInput(stop);
  t.is(
    mockResponse.written,
    '{"type":"input","data":{},"state":"{\\"state\\":{\\"descriptor\\":{\\"id\\":\\"test\\",\\"type\\":\\"test\\"},\\"inputs\\":{},\\"missingInputs\\":[],\\"opportunities\\":[{\\"from\\":\\"test\\",\\"to\\":\\"test\\",\\"out\\":\\"*\\"}],\\"state\\":{\\"state\\":{\\"$type\\":\\"Map\\",\\"value\\":[]},\\"constants\\":{\\"$type\\":\\"Map\\",\\"value\\":[]}},\\"outputs\\":{},\\"skip\\":false,\\"newOpportunities\\":[]},\\"type\\":\\"input\\"}"}\n'
  );
});

test("writes output", async (t) => {
  const mockResponse = new MockResponse();
  const writer = new Writer(mockResponse, async (state) => state);
  const stop = new RunResult(
    {
      descriptor: {
        id: "test",
        type: "test",
      },
      inputs: {},
      missingInputs: [],
      opportunities: [{ from: "test", to: "test", out: "*" }],
      state: new MockEdgeState(),
      outputs: {},
      skip: false,
      newOpportunities: [],
    },
    "output"
  );
  await writer.writeOutput(stop);
  t.is(
    mockResponse.written,
    '{"type":"output","data":{},"state":"{\\"state\\":{\\"descriptor\\":{\\"id\\":\\"test\\",\\"type\\":\\"test\\"},\\"inputs\\":{},\\"missingInputs\\":[],\\"opportunities\\":[{\\"from\\":\\"test\\",\\"to\\":\\"test\\",\\"out\\":\\"*\\"}],\\"state\\":{\\"state\\":{\\"$type\\":\\"Map\\",\\"value\\":[]},\\"constants\\":{\\"$type\\":\\"Map\\",\\"value\\":[]}},\\"outputs\\":{},\\"skip\\":false,\\"newOpportunities\\":[]},\\"type\\":\\"output\\"}"}\n'
  );
});

test("writes beforehandler", async (t) => {
  const mockResponse = new MockResponse();
  const writer = new Writer(mockResponse, async (state) => state);
  const stop = new RunResult(
    {
      descriptor: {
        id: "test",
        type: "test",
      },
      inputs: {},
      missingInputs: [],
      opportunities: [{ from: "test", to: "test", out: "*" }],
      state: new MockEdgeState(),
      outputs: {},
      skip: false,
      newOpportunities: [],
    },
    "beforehandler"
  );
  writer.writeBeforeHandler(stop);
  t.is(
    mockResponse.written,
    '{"type":"beforehandler","data":{"id":"test","type":"test"}}\n'
  );
});

test("writes done", async (t) => {
  const mockResponse = new MockResponse();
  const writer = new Writer(mockResponse, async (state) => state);
  writer.writeDone();
  t.is(mockResponse.written, '{"type":"done","data":{}}\n');
});

test("writes error", async (t) => {
  const mockResponse = new MockResponse();
  const writer = new Writer(mockResponse, async (state) => state);
  writer.writeError(new Error("test"));
  t.is(mockResponse.written, '{"type":"error","data":{"message":"test"}}\n');
});

test("transforms state", async (t) => {
  const mockResponse = new MockResponse();
  const writer = new Writer(mockResponse, async (_state) => "transformed");
  const stop = new RunResult(
    {
      descriptor: {
        id: "test",
        type: "test",
      },
      inputs: {},
      missingInputs: [],
      opportunities: [{ from: "test", to: "test", out: "*" }],
      state: new MockEdgeState(),
      outputs: {},
      skip: false,
      newOpportunities: [],
    },
    "output"
  );
  await writer.writeOutput(stop);
  t.is(
    mockResponse.written,
    '{"type":"output","data":{},"state":"transformed"}\n'
  );
});
