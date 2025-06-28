/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import {
  HTTPClientTransport,
  HTTPServerTransport,
  parseWithStreamsTransform,
} from "../../src/remote/http.js";
import { MockHTTPConnection } from "../helpers/_test-transport.js";
import { StreamCapability, isStreamCapability } from "../../src/stream.js";
import { NodeValue } from "../../src/types.js";

test("parseWithStreamsTransform works as expected", async (t) => {
  const transform = parseWithStreamsTransform();
  const reader = new ReadableStream({
    start(controller) {
      controller.enqueue(JSON.stringify("foo"));
      controller.enqueue(JSON.stringify("bar"));
      controller.enqueue(JSON.stringify({ value: { $type: "Stream", id: 0 } }));
      controller.enqueue(
        JSON.stringify(["http-stream-chunk", { chunk: "baz" }])
      );
      controller.enqueue(
        JSON.stringify(["http-stream-chunk", { chunk: "qux" }])
      );
      controller.enqueue(JSON.stringify(["http-stream-end", {}]));
      controller.close();
    },
  })
    .pipeThrough(transform)
    .getReader();
  const result = await reader.read();
  t.false(result.done);
  t.deepEqual(result.value, "foo");
  const result2 = await reader.read();
  t.false(result2.done);
  t.deepEqual(result2.value, "bar");
  const result3 = await reader.read();
  t.false(result3.done);
  t.truthy(result3.value.value);
  t.true(isStreamCapability(result3.value.value));
  const result4 = await reader.read();
  t.true(result4.done);
  const dataReader = result3.value.value.stream.getReader();
  const dataResult = await dataReader.read();
  t.false(dataResult.done);
  t.deepEqual(dataResult.value, "baz");
  const dataResult2 = await dataReader.read();
  t.false(dataResult2.done);
  t.deepEqual(dataResult2.value, "qux");
  const dataResult3 = await dataReader.read();
  t.true(dataResult3.done);
});

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
  await writer.write(["input", { node: { type: "input" } }]);
  await writer.close();
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

test("HTTPServerTransport handles output with a single stream in it", async (t) => {
  const results: unknown[] = [];
  const request = {
    body: ["run", {}],
  };
  const response = {
    header() {
      return;
    },
    write: (response: unknown) => {
      results.push(response);
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
  const dataStream = new StreamCapability(
    new ReadableStream({
      start(controller) {
        controller.enqueue("foo");
        controller.enqueue("bar");
        controller.close();
      },
    })
  );
  const requestValue = await reader.read();
  t.deepEqual(requestValue.value, ["run", {}]);
  t.false(requestValue.done);
  const doneValue = await reader.read();
  t.true(doneValue.done);
  await writer.write([
    "output",
    { node: { type: "output" }, outputs: { dataStream } },
  ]);
  writer.close();
  t.deepEqual(results, [
    'data: ["output",{"node":{"type":"output"},"outputs":{"dataStream":{"$type":"Stream","id":0}}}]\n\n',
    'data: ["http-stream-chunk",{"chunk":"foo"}]\n\n',
    'data: ["http-stream-chunk",{"chunk":"bar"}]\n\n',
    'data: ["http-stream-end",{}]\n\n',
  ]);
});

test("HTTPClientTransport handles input with a single stream in it", async (t) => {
  const makeChunk = (data: unknown) => {
    return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  };
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
              const data = [
                "output",
                {
                  node: { type: "output" },
                  outputs: {
                    dataStream: { $type: "Stream", id: 0 },
                  },
                },
              ];
              controller.enqueue(makeChunk(data));
              controller.enqueue(
                makeChunk(["http-stream-chunk", { chunk: "foo" }])
              );
              controller.enqueue(
                makeChunk(["http-stream-chunk", { chunk: "bar" }])
              );
              controller.enqueue(makeChunk(["http-stream-end", {}]));
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
  const data = await reader.read();
  t.false(data.done);
  t.like(data.value, [
    "output",
    {
      node: { type: "output" },
    },
  ]);
  const value = data.value as [
    type: string,
    data: { outputs: { dataStream: NodeValue } },
  ];
  const dataStream = value[1].outputs.dataStream;
  t.true(isStreamCapability(dataStream));
  const done = await reader.read();
  t.true(done.done);
  const dataReader = (
    dataStream as StreamCapability<string>
  ).stream.getReader();
  const dataResult = await dataReader.read();
  t.false(dataResult.done);
  t.deepEqual(dataResult.value, "foo");
  const dataResult2 = await dataReader.read();
  t.false(dataResult2.done);
  t.deepEqual(dataResult2.value, "bar");
  const dataResult3 = await dataReader.read();
  t.true(dataResult3.done);
});
