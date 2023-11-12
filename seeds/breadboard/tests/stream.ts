/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { streamFromAsyncGen } from "../src/stream.js";

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
