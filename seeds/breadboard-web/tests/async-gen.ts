/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, test } from "vitest";
import { asyncGen, streamFromAsyncGen } from "../src/async-gen";

test("async-gen", async () => {
  const results = [];
  const yields = [];

  async function* foo() {
    yield 1;
    yield* asyncGen(async (next) => {
      results.push(1.5);
      await next(2);
      results.push(2.5);
      await next(3);
      results.push(3.5);
    });
    yield 4;
  }

  for await (const val of foo()) {
    results.push(val);
    yields.push(val);
  }

  expect(results).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4]);
  expect(yields).toEqual([1, 2, 3, 4]);
});

test("async-gen call to next is optional", async () => {
  const results = [];
  const yields = [];

  async function* foo() {
    yield 1;
    yield* asyncGen(async () => {
      results.push(1.5);
    });
    yield 2;
  }

  for await (const val of foo()) {
    results.push(val);
    yields.push(val);
  }

  expect(results).toEqual([1, 1.5, 2]);
  expect(yields).toEqual([1, 2]);
});

test("streamFromAsyncGen simple", async () => {
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
  expect(results).toEqual([1, 2, 3]);
});

test("streamFromAsyncGen as async iterator", async () => {
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
  expect(results).toEqual([1, 2, 3]);
});
