/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { createMockWorkers } from "../helpers/_test-transport.js";
import { MirrorUniverseKit, TestKit } from "../helpers/_test-kit.js";
import { ProxyClient, ProxyServer } from "../../src/remote/proxy.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../../src/remote/worker.js";
import { Board } from "../../src/board.js";
import { asRuntimeKit, invokeGraph } from "../../src/index.js";

test.skip("Worker transports can handle ProxyServer and ProxyClient", async (t) => {
  const workers = createMockWorkers();
  const hostDispatcher = new PortDispatcher(workers.host);
  const workerDispatcher = new PortDispatcher(workers.worker);

  const server = new ProxyServer(
    new WorkerServerTransport(hostDispatcher.receive("test"))
  );
  server.serve({
    kits: [asRuntimeKit(MirrorUniverseKit)],
    proxy: ["reverser"],
  });

  const client = new ProxyClient(
    new WorkerClientTransport(workerDispatcher.send("test"))
  );
  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input({ hello: "world" })
    .wire("*", kit.reverser().wire("*", board.output()));
  const kits = [client.createProxyKit(["reverser"]), kit];
  const outputs = await invokeGraph(
    { graph: board },
    { hello: "world" },
    { kits }
  );
  t.deepEqual(outputs, { hello: "dlorw" });
});

test.skip("Worker transports can handle proxy tunnels", async (t) => {
  {
    const workers = createMockWorkers();
    const hostDispatcher = new PortDispatcher(workers.host);
    const workerDispatcher = new PortDispatcher(workers.worker);

    const server = new ProxyServer(
      new WorkerServerTransport(hostDispatcher.receive("test"))
    );

    server.serve({
      kits: [asRuntimeKit(TestKit)],
      proxy: [
        {
          node: "test",
          tunnel: {
            hello: "reverser",
          },
        },
        "reverser",
      ],
    });
    const client = new ProxyClient(
      new WorkerClientTransport(workerDispatcher.send("test"))
    );
    const board = new Board();
    const kit = board.addKit(TestKit);
    board
      .input({ hello: "world" })
      .wire(
        "*",
        kit.test().wire("*", kit.reverser().wire("*", board.output()))
      );
    const kits = [client.createProxyKit(["test", "reverser"]), kit];
    const outputs = await invokeGraph(
      { graph: board },
      { hello: "world" },
      { kits }
    );
    t.deepEqual(outputs, { hello: "dlrow" });
  }
  {
    const workers = createMockWorkers();
    const hostDispatcher = new PortDispatcher(workers.host);
    const workerDispatcher = new PortDispatcher(workers.worker);

    const server = new ProxyServer(
      new WorkerServerTransport(hostDispatcher.receive("test"))
    );
    server.serve({
      kits: [asRuntimeKit(TestKit)],
      proxy: [
        {
          node: "test",
          tunnel: {
            hello: {
              to: "reverser",
              when: {
                hello: "bye",
              },
            },
          },
        },
        "reverser",
      ],
    });
    const client = new ProxyClient(
      new WorkerClientTransport(workerDispatcher.send("test"))
    );
    const board = new Board();
    const kit = board.addKit(TestKit);
    board
      .input({ hello: "world" })
      .wire(
        "*",
        kit.test().wire("*", kit.reverser().wire("*", board.output()))
      );
    const kits = [client.createProxyKit(["test", "reverser"]), kit];
    const outputs = await invokeGraph(
      { graph: board },
      { hello: "world" },
      { kits }
    );
    t.deepEqual(outputs, { hello: "DEKCOLB_EULAV" });
  }
});

test.skip("PortDispatcher works as expected", async (t) => {
  {
    const workers = createMockWorkers();
    const hostDispatcher = new PortDispatcher(workers.host);
    const workerDispatcher = new PortDispatcher(workers.worker);

    const hostPort = hostDispatcher.send("test");
    const workerPort = workerDispatcher.receive("test");

    const writer = workerPort.writable.getWriter();
    writer.write("hello");
    writer.write("world");
    writer.close();

    const reader = hostPort.readable.getReader();
    t.is((await reader.read()).value, "hello");
    t.is((await reader.read()).value, "world");
    t.is((await reader.read()).done, true);
  }
  {
    const workers = createMockWorkers();
    const hostDispatcher = new PortDispatcher(workers.host);
    const workerDispatcher = new PortDispatcher(workers.worker);

    const workerPort = workerDispatcher.receive("test");
    const hostPort = hostDispatcher.send("test");

    const writer = workerPort.writable.getWriter();
    writer.write("hello");
    writer.write("world");
    writer.close();

    const reader = hostPort.readable.getReader();
    t.is((await reader.read()).value, "hello");
    t.is((await reader.read()).value, "world");
    t.is((await reader.read()).done, true);
  }
  {
    const workers = createMockWorkers();
    const hostDispatcher = new PortDispatcher(workers.host);
    const workerDispatcher = new PortDispatcher(workers.worker);

    const workerPort = workerDispatcher.receive("test");
    const writer = workerPort.writable.getWriter();
    writer.write("hello");
    writer.write("world");
    writer.close();

    const hostPort = hostDispatcher.send("test");
    const reader = hostPort.readable.getReader();
    t.is((await reader.read()).value, "hello");
    t.is((await reader.read()).value, "world");
    t.is((await reader.read()).done, true);
  }
});
