/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  StreamCapability,
  isStreamCapability,
  parseWithStreams,
  portFactoryToStreams,
  portToStreams,
  streamFromAsyncGen,
  streamFromReader,
  streamFromWriter,
  streamsToAsyncIterable,
  stringifyWithStreams,
} from "../../src/stream.js";

test("stringifyWithStreams works as expected", async (t) => {
  {
    const stream = new ReadableStream();
    const value = {
      a: 1,
      b: new StreamCapability(stream),
    };
    const result = stringifyWithStreams(value);
    t.deepEqual(result, {
      value: '{"a":1,"b":{"$type":"Stream","id":0}}',
      streams: [stream],
    });
  }
  {
    const stream0 = new ReadableStream();
    const stream1 = new ReadableStream();
    const value = {
      a: 1,
      b: new StreamCapability(stream0),
      c: {
        d: new StreamCapability(stream1),
      },
    };
    const result = stringifyWithStreams(value);
    t.deepEqual(result, {
      value:
        '{"a":1,"b":{"$type":"Stream","id":0},"c":{"d":{"$type":"Stream","id":1}}}',
      streams: [stream0, stream1],
    });
  }
  {
    const value = { a: 1, b: { c: 2 } };
    const result = stringifyWithStreams(value);
    t.deepEqual(result, {
      value: '{"a":1,"b":{"c":2}}',
      streams: [],
    });
  }
});

test("parseWithStreams works as expected", async (t) => {
  {
    const stream = new ReadableStream();
    const value = {
      a: 1,
      b: {
        $type: "Stream",
        id: 0,
      },
    };
    const result = parseWithStreams(JSON.stringify(value), () => stream);
    t.deepEqual(result, {
      a: 1,
      b: new StreamCapability(stream),
    });
  }
  {
    const stream0 = new ReadableStream();
    const stream1 = new ReadableStream();
    const value = {
      a: 1,
      b: {
        $type: "Stream",
        id: 0,
      },
      c: {
        d: {
          $type: "Stream",
          id: 1,
        },
      },
    };
    const result = parseWithStreams(JSON.stringify(value), (id) => {
      if (id === 0) return stream0;
      if (id === 1) return stream1;
      t.fail("invalid id");
      return null as unknown as ReadableStream;
    });
    t.deepEqual(result, {
      a: 1,
      b: new StreamCapability(stream0),
      c: {
        d: new StreamCapability(stream1),
      },
    });
  }
  {
    const value = { a: 1, b: { c: 2 } };
    const result = parseWithStreams(JSON.stringify(value), () => {
      t.fail("should not be called");
      return null as unknown as ReadableStream;
    });
    t.deepEqual(result, value);
  }
});

test("streamFromAsyncGen simple", async (t) => {
  async function* gen() {
    yield 1;
    yield 2;
    yield 3;
  }
  const stream = streamFromAsyncGen(gen());
  const reader = stream.getReader();
  const results = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    results.push(value);
  }
  t.deepEqual(results, [1, 2, 3]);
});

test("streamFromAsyncGen as async iterator", async (t) => {
  async function* gen() {
    yield 1;
    yield 2;
    yield 3;
  }
  const stream = streamFromAsyncGen(gen());
  const results = [];
  for await (const value of stream) {
    results.push(value);
  }
  t.deepEqual(results, [1, 2, 3]);
});

test.skip("portToStreams works as expected", async (t) => {
  const { port1, port2 } = new MessageChannel();
  const port1streams = portToStreams(port1);
  const port2streams = portToStreams(port2);

  const clientReader = port1streams.readable.getReader();
  const clientWriter = port1streams.writable.getWriter();

  const serverReader = port2streams.readable.getReader();
  const serverWriter = port2streams.writable.getWriter();

  {
    const results = [];

    await serverWriter.write(1);
    await serverWriter.write(2);
    await serverWriter.write(3);
    await serverWriter.close();

    for (;;) {
      const { done, value } = await clientReader.read();
      if (done) break;
      results.push(value);
    }
    t.deepEqual(results, [1, 2, 3]);
  }

  {
    const results = [];

    await clientWriter.write(1);
    await clientWriter.write(2);
    await clientWriter.write(3);
    await clientWriter.close();

    for (;;) {
      const { done, value } = await serverReader.read();
      if (done) break;
      results.push(value);
    }
    t.deepEqual(results, [1, 2, 3]);
  }
});

test.skip("portToStreams correctly transfers value streams", async (t) => {
  const { port1, port2 } = new MessageChannel();
  const port1streams = portToStreams(port1);
  const port2streams = portToStreams(port2);

  const clientReader = port1streams.readable.getReader();
  const serverWriter = port2streams.writable.getWriter();

  {
    const stream = new ReadableStream<number>({
      async pull(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.close();
      },
    });
    await serverWriter.write(new StreamCapability(stream));
    await serverWriter.close();
  }

  {
    const results = [];

    const streamValue = await clientReader.read();
    t.false(streamValue.done);
    const stream = streamValue.value;
    t.true(isStreamCapability(stream));
    const reader = (stream as StreamCapability<number>).stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }

    t.deepEqual(results, [1, 2, 3]);
  }
});

test("streamsToAsyncIterable works as expected", async (t) => {
  const results: (number | string)[] = [];
  const readable = new ReadableStream<number>({
    async pull(controller) {
      controller.enqueue(1);
      controller.enqueue(2);
      controller.enqueue(3);
      controller.close();
    },
  });
  const writable = new WritableStream<string>({
    async write(chunk) {
      results.push(chunk);
    },
    async close() {
      t.pass();
    },
  });
  const iterable = streamsToAsyncIterable<number, string>(writable, readable);
  for await (const value of iterable) {
    results.push(value.data);
    await value.reply(`number: ${value.data}`);
  }
  t.deepEqual(results, [1, "number: 1", 2, "number: 2", 3, "number: 3"]);
});

test("streamsToAsyncIterable can be used to start communication", async (t) => {
  const results: (number | string)[] = [];
  const readable = new ReadableStream<number>({
    async pull(controller) {
      controller.enqueue(1);
      controller.enqueue(2);
      controller.enqueue(3);
      controller.close();
    },
  });
  const writable = new WritableStream<string>({
    async write(chunk) {
      results.push(chunk);
    },
    async close() {
      t.pass();
    },
  });
  const iterable = streamsToAsyncIterable<number, string>(writable, readable);
  await iterable.start("start");
  for await (const value of iterable) {
    results.push(value.data);
    await value.reply(`number: ${value.data}`);
  }
  t.deepEqual(results, [
    "start",
    1,
    "number: 1",
    2,
    "number: 2",
    3,
    "number: 3",
  ]);
});

test("streamFromReader produces a regular stream", async (t) => {
  const readable = new ReadableStream<number>({
    async pull(controller) {
      controller.enqueue(1);
      controller.enqueue(2);
      controller.enqueue(3);
      controller.close();
    },
  });
  const mainReader = readable.getReader();
  {
    const stream = streamFromReader(mainReader);
    const subReader = stream.getReader();
    const value = await subReader.read();
    t.deepEqual(value, { done: false, value: 1 });
  }
  {
    const stream = streamFromReader(mainReader);
    const subReader = stream.getReader();
    const value1 = await subReader.read();
    t.deepEqual(value1, { done: false, value: 2 });
    const value2 = await subReader.read();
    t.deepEqual(value2, { done: false, value: 3 });
  }
  {
    const stream = streamFromReader(mainReader);
    const subReader = stream.getReader();
    const value = await subReader.read();
    t.deepEqual(value, { done: true, value: undefined });
  }
});

test("streamFromWriter produces a regular stream", async (t) => {
  const results: number[] = [];
  const writable = new WritableStream<number>({
    async write(chunk) {
      results.push(chunk);
    },
  });
  const mainWriter = writable.getWriter();
  {
    const stream = streamFromWriter(mainWriter);
    const subWriter = stream.getWriter();
    await subWriter.write(1);
    await subWriter.close();
  }
  {
    const stream = streamFromWriter(mainWriter);
    const subWriter = stream.getWriter();
    await subWriter.write(2);
    await subWriter.close();
  }
  {
    const stream = streamFromWriter(mainWriter);
    const subWriter = stream.getWriter();
    await subWriter.close();
  }
  t.deepEqual(results, [1, 2]);
  t.is(writable.locked, true);
});

test.skip("portFactoryToStreams works as expected", async (t) => {
  const results: (number | string | undefined)[] = [];
  let done: () => void;
  const createPort2 = async () => {
    const { port1, port2 } = new MessageChannel();
    const port1streams = portToStreams<string, number>(port1);
    const writer = port1streams.writable.getWriter();
    writer.write(1);
    writer.write(2);
    writer.write(3);
    writer.close();
    const reader = port1streams.readable.getReader();
    reader.read().then((value) => {
      results.push(value.value);
      reader.read().then((value) => {
        results.push(value.value);
        reader.read().then((value) => {
          results.push(value.value);
          reader.read().then((value) => {
            results.push(value.value);
            t.deepEqual(results, ["a", 1, 2, 3, "b", "c", undefined]);
            done();
          });
        });
      });
    });
    return port2;
  };
  const port2streams = portFactoryToStreams<number, string>(createPort2);
  const reader = port2streams.readable.getReader();
  const writer = port2streams.writable.getWriter();
  await writer.write("a");
  results.push((await reader.read()).value);
  await writer.write("b");
  results.push((await reader.read()).value);
  await writer.write("c");
  results.push((await reader.read()).value);
  writer.close();
  return new Promise((resolve) => {
    done = resolve;
  });
});
