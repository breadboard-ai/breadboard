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
import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
} from "../../src/remote/protocol.js";
import { Board } from "../../src/board.js";
import { TestKit } from "../helpers/_test-kit.js";

test("HTTPServerTransport does the basics", async (t) => {
  const request = {
    body: ["run", {}],
  };
  const response = {
    write: (response: unknown) => {
      t.deepEqual(response, ["input", { node: { type: "input" } }]);
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
  t.false(requestValue.done);
  const doneValue = await reader.read();
  t.true(doneValue.done);
  t.deepEqual(requestValue.value, ["run", {}]);
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
    write: (response: AnyRunResponseMessage) => {
      t.like(response, ["input", { node: { type: "input" } }]);
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
  const reader = stream.readableResponses.getReader();
  writer.write(["run", {}]);
  writer.close();
  const response = await reader.read();
  t.false(response.done);
  t.deepEqual(response.value, ["input", { node: {} }]);
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
