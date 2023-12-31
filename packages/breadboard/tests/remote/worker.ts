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
  WorkerClientTransport,
  WorkerServerTransport,
} from "../../src/remote/worker.js";
import { Board } from "../../src/board.js";

test("Worker transports can handle ProxyServer and ProxyClient", async (t) => {
  const workers = createMockWorkers();

  const serverBoard = new Board();
  serverBoard.addKit(MirrorUniverseKit);
  const server = new ProxyServer(new WorkerServerTransport(workers.host));
  server.serve({ board: serverBoard, proxy: ["reverser"] });

  const client = new ProxyClient(new WorkerClientTransport(workers.worker));
  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input({ hello: "world" })
    .wire("*", kit.reverser().wire("*", board.output()));
  const kits = [client.createProxyKit(["reverser"]), kit];
  const outputs = await board.runOnce({ hello: "world" }, { kits });
  t.deepEqual(outputs, { hello: "dlorw" });
});

test("Worker transports can handle proxy tunnels", async (t) => {
  {
    const workers = createMockWorkers();
    const serverBoard = new Board();
    serverBoard.addKit(TestKit);
    const server = new ProxyServer(new WorkerServerTransport(workers.host));

    server.serve({
      board: serverBoard,
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
    const client = new ProxyClient(new WorkerClientTransport(workers.worker));
    const board = new Board();
    const kit = board.addKit(TestKit);
    board
      .input({ hello: "world" })
      .wire(
        "*",
        kit.test().wire("*", kit.reverser().wire("*", board.output()))
      );
    const kits = [client.createProxyKit(["test", "reverser"]), kit];
    const outputs = await board.runOnce({ hello: "world" }, { kits });
    t.deepEqual(outputs, { hello: "dlrow" });
  }
  {
    const workers = createMockWorkers();
    const serverBoard = new Board();
    serverBoard.addKit(TestKit);
    const server = new ProxyServer(new WorkerServerTransport(workers.host));
    server.serve({
      board: serverBoard,
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
    const client = new ProxyClient(new WorkerClientTransport(workers.worker));
    const board = new Board();
    const kit = board.addKit(TestKit);
    board
      .input({ hello: "world" })
      .wire(
        "*",
        kit.test().wire("*", kit.reverser().wire("*", board.output()))
      );
    const kits = [client.createProxyKit(["test", "reverser"]), kit];
    const outputs = await board.runOnce({ hello: "world" }, { kits });
    t.deepEqual(outputs, { hello: "DEKCOLB_EULAV" });
  }
});
