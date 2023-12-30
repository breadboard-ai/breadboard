/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  InputPromiseResponseMessage,
} from "../../src/remote/protocol.js";
import { Board } from "../../src/board.js";
import { TestKit } from "../helpers/_test-kit.js";
import {
  IdentityTransport,
  MockWorkerTransport,
} from "../helpers/_test-transport.js";
import { RunClient, RunServer } from "../../src/remote/run.js";

test("Interruptible streaming", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const run = async (request: AnyRunRequestMessage) => {
    const transport = new IdentityTransport<
      AnyRunRequestMessage,
      AnyRunResponseMessage
    >();
    const server = new RunServer(transport);
    server.serve(board);
    const client = transport.createClientStream();
    const writer = client.writableRequests.getWriter();
    writer.write(request);
    writer.close();
    return client.readableResponses;
  };

  let intermediateState;
  for await (const result of await run(["run", {}])) {
    const [type, response, state] = result as InputPromiseResponseMessage;
    t.is(type, "input");
    t.is(response.node.type, "input");
    t.deepEqual(response.inputArguments, { foo: "bar" });
    intermediateState = state;
  }
  t.assert(intermediateState !== undefined);
  const secondRunResults = [];
  let outputs;
  for await (const result of await run([
    "input",
    {
      inputs: { hello: "world" },
    },
    intermediateState as string,
  ])) {
    const [type, , state] = result;
    if (type === "output") {
      const [, output] = result;
      outputs = output.outputs;
    }
    t.assert(state === undefined);
    secondRunResults.push(type);
  }
  t.deepEqual(outputs, { hello: "world" });
  t.deepEqual(secondRunResults, ["output", "end"]);
});

test("Continuous streaming", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const transport = new MockWorkerTransport<
    AnyRunRequestMessage,
    AnyRunResponseMessage
  >();
  const server = new RunServer(transport);
  server.serve(board);
  const { writableRequests: requests, readableResponses: responses } =
    transport.createClientStream();
  const writer = requests.getWriter();
  const reader = responses.getReader();

  writer.write(["run", {}]);
  const firsResult = await reader.read();
  t.assert(!firsResult.done);
  t.like(firsResult.value, [
    "input",
    { node: { type: "input" }, inputArguments: { foo: "bar" } },
  ]);
  writer.write(["input", { inputs: { hello: "world" } }, ""]);
  // second result was "beforehandler" (now "nodestart"), but I removed it
  // because of the refactoring to use diagnostics.
  const thirdResult = await reader.read();
  t.assert(!thirdResult.done);
  t.like(thirdResult.value, ["output", { outputs: { hello: "world" } }]);
  const fourthResult = await reader.read();
  t.assert(!fourthResult.done);
  t.like(fourthResult.value, ["end", {}]);
  const fifthResult = await reader.read();
  t.assert(fifthResult.done);
});

test("runOnce client can run once", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const transport = new MockWorkerTransport<
    AnyRunRequestMessage,
    AnyRunResponseMessage
  >();
  const server = new RunServer(transport);
  const client = new RunClient(transport);

  server.serve(board);
  const outputs = await client.runOnce({ hello: "world" });

  t.deepEqual(outputs, { hello: "world" });
});
