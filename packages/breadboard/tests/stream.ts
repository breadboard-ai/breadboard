/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { portToStreams, streamFromAsyncGen } from "../src/stream.js";

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

test("portToStreams works as expected", async (t) => {
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
