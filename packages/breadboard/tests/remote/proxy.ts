/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  MockHTTPConnection,
  createMockWorkers,
} from "../helpers/_test-transport.js";
import { ProxyClient, ProxyServer } from "../../src/remote/proxy.js";
import {
  HTTPClientTransport,
  HTTPServerTransport,
} from "../../src/remote/http.js";
import { AnyProxyRequestMessage } from "../../src/remote/protocol.js";
import { Board } from "../../src/board.js";
import { MirrorUniverseKit, TestKit } from "../helpers/_test-kit.js";
import { StreamCapability } from "../../src/stream.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../../src/remote/worker.js";
import { asRuntimeKit } from "../../src/index.js";

test("ProxyServer can use HTTPServerTransport", async (t) => {
  const kits = [asRuntimeKit(TestKit)];
  const request = {
    body: [
      "proxy",
      { node: { id: "id", type: "noop" }, inputs: { hello: "world" } },
    ] as AnyProxyRequestMessage,
  };
  const response = {
    header() {
      return;
    },
    write: (response: unknown) => {
      const data = JSON.parse((response as string).slice(6));
      t.deepEqual(data, ["proxy", { outputs: { hello: "world" } }]);
      return true;
    },
    end: () => {
      t.pass();
    },
  };
  const transport = new HTTPServerTransport(request, response);
  const server = new ProxyServer(transport);
  await server.serve({ kits, proxy: ["noop"] });
});

test("End-to-end proxy works with HTTP transports", async (t) => {
  const connection = new MockHTTPConnection<AnyProxyRequestMessage>();
  connection.onRequest(async (request, response) => {
    const kits = [asRuntimeKit(TestKit)];
    const server = new ProxyServer(new HTTPServerTransport(request, response));
    await server.serve({ kits, proxy: ["reverser"] });
  });
  const client = new ProxyClient(
    new HTTPClientTransport("http://example.com", { fetch: connection.fetch })
  );
  const result = await client.proxy(
    { id: "id", type: "reverser" },
    { hello: "world" },
    {}
  );
  t.deepEqual(result, { hello: "dlrow" });
});

test("ProxyClient creates functional proxy kits", async (t) => {
  const connection = new MockHTTPConnection<AnyProxyRequestMessage>();
  connection.onRequest(async (request, response) => {
    const kits = [asRuntimeKit(MirrorUniverseKit)];
    const server = new ProxyServer(new HTTPServerTransport(request, response));
    await server.serve({ kits, proxy: ["reverser"] });
  });
  const client = new ProxyClient(
    new HTTPClientTransport("http://example.com", { fetch: connection.fetch })
  );
  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input({ hello: "world" })
    .wire("*", kit.reverser().wire("*", board.output()));
  const kits = [client.createProxyKit(["reverser"]), kit];
  const outputs = await board.runOnce({ hello: "world" }, { kits });
  t.deepEqual(outputs, { hello: "dlorw" });
});

test("ProxyServer can be configured to tunnel nodes", async (t) => {
  {
    const connection = new MockHTTPConnection<AnyProxyRequestMessage>();
    connection.onRequest(async (request, response) => {
      const kits = [asRuntimeKit(TestKit)];
      const server = new ProxyServer(
        new HTTPServerTransport(request, response)
      );
      await server.serve({
        kits,
        proxy: [{ node: "test", tunnel: { hello: "reverser" } }, "reverser"],
      });
    });
    const client = new ProxyClient(
      new HTTPClientTransport("http://example.com", { fetch: connection.fetch })
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
    const outputs = await board.runOnce({ hello: "world" }, { kits });
    t.deepEqual(outputs, { hello: "dlrow" });
  }
  {
    const connection = new MockHTTPConnection<AnyProxyRequestMessage>();
    connection.onRequest(async (request, response) => {
      const kits = [asRuntimeKit(TestKit)];
      const server = new ProxyServer(
        new HTTPServerTransport(request, response)
      );
      await server.serve({
        kits,
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
    });
    const client = new ProxyClient(
      new HTTPClientTransport("http://example.com", { fetch: connection.fetch })
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
    const outputs = await board.runOnce({ hello: "world" }, { kits });
    t.deepEqual(outputs, { hello: "DEKCOLB_EULAV" });
  }
});

test("ProxyServer and ProxyClient correctly handle streams", async (t) => {
  {
    const connection = new MockHTTPConnection<AnyProxyRequestMessage>();
    connection.onRequest(async (request, response) => {
      const kits = [asRuntimeKit(TestKit)];
      const server = new ProxyServer(
        new HTTPServerTransport(request, response)
      );
      await server.serve({ kits, proxy: ["streamer"] });
    });
    const client = new ProxyClient(
      new HTTPClientTransport("http://example.com", { fetch: connection.fetch })
    );
    const board = new Board();
    const kit = board.addKit(TestKit);
    board
      .input({ hello: "world" })
      .wire("*", kit.streamer().wire("*", board.output()));
    const kits = [client.createProxyKit(["streamer"]), kit];
    const outputs = await board.runOnce({ hello: "world" }, { kits });
    t.like(outputs, { stream: { kind: "stream" } });
    const stream = (outputs.stream as StreamCapability<string>).stream;
    const reader = stream.getReader();
    const chunks: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    t.deepEqual(
      chunks.join(""),
      "Breadboard is a project that helps you make AI boards. "
    );
  }
  {
    const mockWorkers = createMockWorkers();
    const hostDispatcher = new PortDispatcher(mockWorkers.host);
    const workerDispatcher = new PortDispatcher(mockWorkers.worker);

    const client = new ProxyClient(
      new WorkerClientTransport(hostDispatcher.send("proxy"))
    );
    const server = new ProxyServer(
      new WorkerServerTransport(workerDispatcher.receive("proxy"))
    );
    server.serve({ kits: [asRuntimeKit(TestKit)], proxy: ["streamer"] });
    const board = new Board();
    const kit = board.addKit(TestKit);
    board
      .input({ hello: "world" })
      .wire("*", kit.streamer().wire("*", board.output()));
    const kits = [client.createProxyKit(["streamer"]), kit];
    const outputs = await board.runOnce({ hello: "world" }, { kits });
    t.like(outputs, { stream: { kind: "stream" } });
    const stream = (outputs.stream as StreamCapability<string>).stream;
    const reader = stream.getReader();
    const chunks: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    t.deepEqual(
      chunks.join(""),
      "Breadboard is a project that helps you make AI boards. "
    );
  }
});

test("ProxyClient can shut down ProxyServer", async (t) => {
  let done: () => void;
  const mockWorkers = createMockWorkers();
  const hostDispatcher = new PortDispatcher(mockWorkers.host);
  const workerDispatcher = new PortDispatcher(mockWorkers.worker);

  const proxyClient = new ProxyClient(
    new WorkerClientTransport(hostDispatcher.send("proxy"))
  );
  const proxyServer = new ProxyServer(
    new WorkerServerTransport(workerDispatcher.receive("proxy"))
  );
  proxyServer.serve({ kits: [] }).then(() => done());
  proxyClient.shutdownServer();
  t.pass();
  return new Promise((resolve) => {
    done = resolve;
  });
});
