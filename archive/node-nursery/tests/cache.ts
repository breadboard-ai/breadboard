/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { SQLiteCacheManager } from "../src/cache.js";

const cacheManager = new SQLiteCacheManager(":memory:");

test("should return null for a key that has not been set", async (t) => {
  const cache = cacheManager.getCache({ version: "1.0.0" });
  const result = await cache.get("non-existent-key");
  t.is(result, null);
});

test("should return the value for a key that has been set", async (t) => {
  const cache = cacheManager.getCache({ version: "1.0.1" });
  await cache.set("key", "value");
  const result = await cache.get("key");
  t.is(result, "value");
});

test("should return the value for a structured key that has been set", async (t) => {
  const cache = cacheManager.getCache({ version: "1.0.2" });
  await cache.set({ key: 0 }, "value");
  const result = await cache.get({ key: 0 });
  t.is(result, "value");
});

test("should return the structured value for a key that has been set", async (t) => {
  const cache = cacheManager.getCache({ version: "1.0.3" });
  await cache.set("key", { value: 3 });
  const result = (await cache.get("key")) as object;
  t.deepEqual(result, { value: 3 });
});

test("should overwrite the value for a key that has been set", async (t) => {
  const cache = cacheManager.getCache({ version: "1.0.4" });
  await cache.set("key", "value");
  await cache.set("key", "new-value");
  const result = await cache.get("key");
  t.is(result, "new-value");
});

test("should not return values set under a different model version", async (t) => {
  const cache = cacheManager.getCache({ version: "1.0.5" });
  await cache.set("key", "value");

  const newCache = cacheManager.getCache({ version: "2.0.0" });
  const result = await newCache.get("key");
  t.is(result, null);
});

test("should clear the cache", async (t) => {
  const cache = cacheManager.getCache({ version: "1.0.0" });
  await cache.set("key", "value");
  const result1 = await cache.get("key");
  t.is(result1, "value");
  await cache.clear();
  const result2 = await cache.get("key");
  t.is(result2, null);
});
