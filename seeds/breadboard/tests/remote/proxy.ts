/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { MockHTTPConnection } from "../helpers/_test-transport.js";
import { ProxyClient, ProxyServer } from "../../src/remote/proxy.js";
import {
  HTTPClientTransport,
  HTTPServerTransport,
} from "../../src/remote/http.js";
import { AnyProxyRequestMessage } from "../../src/remote/protocol.js";
import { Board } from "../../src/board.js";
import { MirrorUniverseKit, TestKit } from "../helpers/_test-kit.js";

test("ProxyServer can use HTTPServerTransport", async (t) => {
  const board = new Board();
  board.addKit(TestKit);

  const request = {
    body: [
      "proxy",
      { node: { id: "id", type: "noop" }, inputs: { hello: "world" } },
    ] as AnyProxyRequestMessage,
  };
  const response = {
    write: (response: unknown) => {
      const data = JSON.parse(response as string);
      t.deepEqual(data, ["proxy", { outputs: { hello: "world" } }]);
      return true;
    },
    end: () => {
      t.pass();
    },
  };
  const transport = new HTTPServerTransport(request, response);
  const server = new ProxyServer(transport);
  await server.serve({ board, proxy: ["noop"] });
});

test("End-to-end proxy works with HTTP transports", async (t) => {
  const connection = new MockHTTPConnection<AnyProxyRequestMessage>();
  connection.onRequest(async (request, response) => {
    const serverBoard = new Board();
    serverBoard.addKit(TestKit);
    const server = new ProxyServer(new HTTPServerTransport(request, response));
    await server.serve({ board: serverBoard, proxy: ["reverser"] });
  });
  const client = new ProxyClient(
    new HTTPClientTransport("http://example.com", { fetch: connection.fetch })
  );
  const result = await client.proxy(
    { id: "id", type: "reverser" },
    { hello: "world" }
  );
  t.deepEqual(result, { hello: "dlrow" });
});

test("ProxyClient creates functional proxy kits", async (t) => {
  const connection = new MockHTTPConnection<AnyProxyRequestMessage>();
  connection.onRequest(async (request, response) => {
    const serverBoard = new Board();
    serverBoard.addKit(MirrorUniverseKit);
    const server = new ProxyServer(new HTTPServerTransport(request, response));
    await server.serve({ board: serverBoard, proxy: ["reverser"] });
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
      const serverBoard = new Board();
      serverBoard.addKit(TestKit);
      const server = new ProxyServer(
        new HTTPServerTransport(request, response)
      );
      await server.serve({
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
      const serverBoard = new Board();
      serverBoard.addKit(TestKit);
      const server = new ProxyServer(
        new HTTPServerTransport(request, response)
      );
      await server.serve({
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
