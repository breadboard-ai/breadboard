/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { asyncGen } from "../../src/async-gen.js";

test("asyncGen basics work", async (t) => {
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

  t.deepEqual(results, [1, 1.5, 2, 2.5, 3, 3.5, 4]);
  t.deepEqual(yields, [1, 2, 3, 4]);
});

test("asyncGen call to next is optional", async (t) => {
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

  t.deepEqual(results, [1, 1.5, 2]);
  t.deepEqual(yields, [1, 2]);
});

test("asyncGen can handle exceptions", async (t) => {
  const results = [];
  const yields = [];

  async function* foo() {
    yield 1;
    yield* asyncGen(async (next) => {
      results.push(1.5);
      await next(2);
      results.push(2.5);
      throw new Error("test");
    });
    yield 3;
  }

  try {
    for await (const val of foo()) {
      results.push(val);
      yields.push(val);
    }
  } catch (e) {
    t.is((e as Error).message, "test");
  }

  t.deepEqual(results, [1, 1.5, 2, 2.5]);
  t.deepEqual(yields, [1, 2]);
});

test("asyncGen correctly waits for next", async (t) => {
  async function* foo() {
    yield* asyncGen<{ value: number }>(async (next) => {
      const state = { value: 1 };
      await next(state);
      t.is(state.value, 2);
      state.value++;
      await next(state);
      t.is(state.value, 4);
    });
  }

  for await (const val of foo()) {
    val.value++;
  }
});

test("asyncGen non-awaited next calls queue correctly", async (t) => {
  const results = [];
  async function* foo() {
    yield* asyncGen(async (next) => {
      results.push(0.5);
      next(1);
      results.push(1.5);
      next(2);
      results.push(2.5);
      await next(3);
      results.push(3.5);
      next(4);
      results.push(4.5);
    });
  }
  const yields = [];
  for await (const val of foo()) {
    yields.push(val);
    results.push(val);
  }
  t.deepEqual(yields, [1, 2, 3, 4]);
  t.deepEqual(results, [0.5, 1.5, 2.5, 1, 2, 3, 3.5, 4.5, 4]);
});
