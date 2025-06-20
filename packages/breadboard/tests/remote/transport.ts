/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { AnyRunRequestMessage, RemoteMessage } from "../../src/remote/types.js";
import { Board } from "../../src/board.js";
import { TestKit } from "../helpers/_test-kit.js";
import { createMockWorkers } from "../helpers/_test-transport.js";
import { RunClient, RunServer } from "../../src/remote/run.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../../src/remote/worker.js";

test.skip("Continuous streaming", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  // Set up the transports.
  const mockWorkers = createMockWorkers();

  const hostDispatcher = new PortDispatcher(mockWorkers.host);
  const workerDispatcher = new PortDispatcher(mockWorkers.worker);

  const clientTransport = new WorkerClientTransport<
    AnyRunRequestMessage,
    RemoteMessage
  >(hostDispatcher.send("test"));
  const server = new RunServer(
    new WorkerServerTransport(workerDispatcher.receive("test"))
  );

  // Serve the board.
  server.serve(board, false, { kits: [kit] });

  // Hand-craft running the board
  const { writableRequests: requests, readableResponses: responses } =
    clientTransport.createClientStream();
  const writer = requests.getWriter();
  const reader = responses.getReader();

  writer.write(["run", {}]);
  const firsResult = await reader.read();
  t.assert(!firsResult.done);
  t.like(firsResult.value, [
    "input",
    { node: { type: "input" }, inputArguments: { foo: "bar" } },
  ]);
  writer.write(["input", { inputs: { hello: "world" } }, undefined as never]);
  // second result was "beforehandler" (now "nodestart"), but I removed it
  // because of the refactoring to use diagnostics.
  const thirdResult = await reader.read();
  t.assert(!thirdResult.done);
  t.like(thirdResult.value, ["output", { outputs: { hello: "world" } }]);
  const fourthResult = await reader.read();
  t.assert(!fourthResult.done);
  t.like(fourthResult.value, ["end"]);
  const fifthResult = await reader.read();
  t.assert(fifthResult.done);
});

test.skip("runOnce client can run once (client starts first)", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const mockWorkers = createMockWorkers();
  const hostDispatcher = new PortDispatcher(mockWorkers.host);
  const workerDispatcher = new PortDispatcher(mockWorkers.worker);

  const client = new RunClient(
    new WorkerClientTransport(hostDispatcher.send("test"))
  );
  const server = new RunServer(
    new WorkerServerTransport(workerDispatcher.receive("test"))
  );

  server.serve(board, false, { kits: [kit] });
  const outputs = await client.runOnce({ hello: "world" });

  t.deepEqual(outputs, { hello: "world" });
});

test.skip("runOnce client can run once (server starts first)", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const mockWorkers = createMockWorkers();
  const hostDispatcher = new PortDispatcher(mockWorkers.host);
  const workerDispatcher = new PortDispatcher(mockWorkers.worker);

  const server = new RunServer(
    new WorkerServerTransport(workerDispatcher.receive("test"))
  );
  const client = new RunClient(
    new WorkerClientTransport(hostDispatcher.send("test"))
  );

  server.serve(board, false, { kits: [kit] });
  const outputs = await client.runOnce({ hello: "world" });

  t.deepEqual(outputs, { hello: "world" });
});
