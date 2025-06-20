/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { createMockWorkers } from "../helpers/_test-transport.js";
import { InitClient, InitServer } from "../../src/remote/init.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../../src/remote/worker.js";

test.skip("InitServer and InitClient work together", async (t) => {
  const mockWorkers = createMockWorkers();
  const hostDispatcher = new PortDispatcher(mockWorkers.host);
  const workerDispatcher = new PortDispatcher(mockWorkers.worker);
  const client = new InitClient(
    new WorkerClientTransport(workerDispatcher.send("test"))
  );
  const server = new InitServer(
    new WorkerServerTransport(hostDispatcher.receive("test"))
  );

  const url = "https://example.com";
  client.load(url);

  await server.serve();

  t.is(url, url);
});
