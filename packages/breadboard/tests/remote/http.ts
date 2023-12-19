/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import {
  HTTPClientTransport,
  HTTPServerTransport,
} from "../../src/remote/http.js";
import { RunServer } from "../../src/remote/run.js";
import { AnyRunRequestMessage } from "../../src/remote/protocol.js";
import { Board } from "../../src/board.js";
import { TestKit } from "../helpers/_test-kit.js";
import { MockHTTPConnection } from "../helpers/_test-transport.js";

test("HTTPServerTransport does the basics", async (t) => {
  const request = {
    body: ["run", {}],
  };
  const response = {
    header() {
      return;
    },
    write: (response: unknown) => {
      t.deepEqual(response, 'data: ["input",{"node":{"type":"input"}}]\n\n');
      return true;
    },
    end: () => {
      t.pass();
    },
  };
  const transport = new HTTPServerTransport(request, response);
  const stream = transport.createServerStream();
  const writer = stream.writableResponses.getWriter();
  const reader = stream.readableRequests.getReader();
  const requestValue = await reader.read();
  t.deepEqual(requestValue.value, ["run", {}]);
  t.false(requestValue.done);
  const doneValue = await reader.read();
  t.true(doneValue.done);
  writer.write(["input", { node: { type: "input" } }]);
  writer.close();
});

test("RunServer can use HTTPServerTransport", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const request = {
    body: ["run", {}] as AnyRunRequestMessage,
  };
  const response = {
    header() {
      return;
    },
    write: (response: unknown) => {
      const data = JSON.parse((response as string).slice(6));
      t.like(data, ["input", { node: { type: "input" } }]);
      return true;
    },
    end: () => {
      t.pass();
    },
  };
  const transport = new HTTPServerTransport(request, response);
  const server = new RunServer(transport);
  await server.serve(board);
});

test("MockHTTPConnection works as advertised", async (t) => {
  const connection = new MockHTTPConnection();
  connection.onRequest(async (request, response) => {
    t.like(request, {
      body: ["run", {}],
    });
    response.write(JSON.stringify(["input", { node: {} }]));
    response.end();
  });
  const response = await connection.fetch("http://example.com", {
    method: "POST",
    body: JSON.stringify(["run", {}]),
  });
  t.true(response.ok);
  const reader = response.body
    ?.pipeThrough(new TextDecoderStream())
    .getReader();
  t.assert(reader);
  const result = await reader?.read();
  t.false(result?.done);
  t.deepEqual(result?.value, '["input",{"node":{}}]');
});

test("MockHTTPConnection end-to-end test", async (t) => {
  const connection = new MockHTTPConnection();
  const clientTransport = new HTTPClientTransport("http://example.com", {
    fetch: connection.fetch,
  });
  connection.onRequest(async (request, response) => {
    const serverTransport = new HTTPServerTransport(request, response);
    const stream = serverTransport.createServerStream();
    const reader = stream.readableRequests.getReader();
    const data = await reader.read();
    t.false(data.done);
    t.deepEqual(data.value, ["run", {}]);
    const writer = stream.writableResponses.getWriter();
    writer.write(["input", { node: {} }]);
    writer.close();
  });
  const stream = clientTransport.createClientStream();
  const writer = stream.writableRequests.getWriter();
  const reader = stream.readableResponses.getReader();
  writer.write(["run", {}]);
  writer.close();
  const data = await reader.read();
  t.false(data.done);
  t.deepEqual(data.value, ["input", { node: {} }]);
  const done = await reader.read();
  t.true(done.done);
});

test("HTTPClientTransport does the basics", async (t) => {
  const transport = new HTTPClientTransport("http://example.com", {
    fetch: async (url, init) => {
      t.is(url, "http://example.com");
      t.like(init, {
        method: "POST",
        body: JSON.stringify(["run", {}]),
      });
      return {
        ok: true,
        get body() {
          return new ReadableStream({
            start(controller) {
              const data = ["input", { node: {} }];
              const chunk = new TextEncoder().encode(
                `data: ${JSON.stringify(data)}\n\n`
              );
              controller.enqueue(chunk);
              controller.close();
            },
          });
        },
      } as unknown as globalThis.Response;
    },
  });
  const stream = transport.createClientStream();
  const writer = stream.writableRequests.getWriter();
  const reader = stream.readableResponses.getReader();
  writer.write(["run", {}]);
  writer.close();
  const response = await reader.read();
  t.false(response.done);
  t.deepEqual(response.value, ["input", { node: {} }]);
  const done = await reader.read();
  t.true(done.done);
});

test("HTTPClientTransport handles broken chunks", async (t) => {
  const connection = new MockHTTPConnection({ breakChunks: true });
  const clientTransport = new HTTPClientTransport("http://example.com", {
    fetch: connection.fetch,
  });
  connection.onRequest(async (request, response) => {
    const serverTransport = new HTTPServerTransport(request, response);
    const stream = serverTransport.createServerStream();
    const reader = stream.readableRequests.getReader();
    const data = await reader.read();
    t.false(data.done);
    t.deepEqual(data.value, ["run", {}]);
    const writer = stream.writableResponses.getWriter();
    writer.write(["input", { node: {} }]);
    writer.close();
  });
  const stream = clientTransport.createClientStream();
  const writer = stream.writableRequests.getWriter();
  const reader = stream.readableResponses.getReader();
  writer.write(["run", {}]);
  writer.close();
  const data = await reader.read();
  t.false(data.done);
  t.deepEqual(data.value, ["input", { node: {} }]);
  const done = await reader.read();
  t.true(done.done);
});

test("HTTPClientTransport complains about multiple writes", async (t) => {
  const transport = new HTTPClientTransport("http://example.com", {
    fetch: async (url, init) => {
      t.is(url, "http://example.com");
      t.like(init, {
        method: "POST",
        body: JSON.stringify(["run", {}]),
      });
      return {
        ok: true,
        get body() {
          return new ReadableStream({
            start(controller) {
              const data = ["input", { node: {} }];
              const chunk = new TextEncoder().encode(JSON.stringify(data));
              controller.enqueue(chunk);
              controller.close();
            },
          });
        },
      } as unknown as globalThis.Response;
    },
  });
  const stream = transport.createClientStream();
  const writer = stream.writableRequests.getWriter();
  writer.write(["run", {}]);
  await t.throwsAsync(() => writer.write(["run", {}]), {
    message: "HTTPClientTransport supports only one write per stream instance.",
  });
});
