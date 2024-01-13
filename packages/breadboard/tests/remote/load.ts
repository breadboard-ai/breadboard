/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { createMockWorkers } from "../helpers/_test-transport.js";
import { LoadClient, LoadServer } from "../../src/remote/load.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../../src/remote/worker.js";
import { Board } from "../../src/index.js";

test("LoadServer and LoadClient work together", async (t) => {
  const mockWorkers = createMockWorkers();
  const hostDispatcher = new PortDispatcher(mockWorkers.host);
  const workerDispatcher = new PortDispatcher(mockWorkers.worker);
  const client = new LoadClient(
    new WorkerClientTransport(workerDispatcher.send("test"))
  );
  const server = new LoadServer(
    new WorkerServerTransport(hostDispatcher.receive("test"))
  );

  const url = "https://example.com";
  server.serve(async (url) => {
    t.is(url, url);
    return new Board({
      title: "test title",
      description: "test description",
      version: "1.0.0",
    });
  });

  const response = await client.load(url);
  t.deepEqual(response, {
    title: "test title",
    description: "test description",
    version: "1.0.0",
    url,
    diagram: "graph TD;\n",
    nodes: [],
  });
});
