/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { InMemoryBlobStore } from "../../../src/file-system/in-memory-blob-store.js";
import { good, inline } from "../test-file-system.js";
import { deepStrictEqual, ok } from "node:assert";

describe("File System in-memory blob store", () => {
  it("deflates parts and tracks handles", async () => {
    const store = new InMemoryBlobStore();
    const deflator = store.deflator();
    {
      const result = await deflator.transform("/tmp/bar", inline("foo"));
      good(result) && ok("storedData" in result);
    }
    deepStrictEqual(store.handles.size, 1);
    {
      const result = await deflator.transform("/tmp/bar", inline("bar"));
      good(result) && ok("storedData" in result);
    }
    deepStrictEqual(store.handles.size, 1);
    {
      const result = await deflator.transform("/tmp/baz", inline("baz"));
      good(result) && ok("storedData" in result);
    }
    deepStrictEqual(store.handles.size, 2);
    {
      const result = await deflator.transform("/tmp/qux", inline("qux"));
      good(result) && ok("storedData" in result);
    }
    deepStrictEqual(store.handles.size, 3);
  });

  it("inflates deflated parts", async () => {
    const store = new InMemoryBlobStore();
    const deflator = store.deflator();
    const deflated = await deflator.transform("/tmp/bar", inline("foo"));
    if (good(deflated)) {
      ok("storedData" in deflated);
      const inflator = store.inflator();
      const result = await inflator.transform("/tmp/bar", deflated);
      good(result) && deepStrictEqual(result, inline("foo"));
    }
  });

  it("cleans up after itself", async () => {
    const store = new InMemoryBlobStore();
    const deflator = store.deflator();
    {
      const result = await deflator.transform("/tmp/bar", inline("foo"));
      good(result) && ok("storedData" in result);
    }
    deepStrictEqual(store.handles.size, 1);
    {
      const result = await deflator.transform("/tmp/bar", inline("bar"));
      good(result) && ok("storedData" in result);
    }
    deepStrictEqual(store.handles.size, 1);
    {
      const result = await deflator.transform("/tmp/baz", inline("baz"));
      good(result) && ok("storedData" in result);
    }
    deepStrictEqual(store.handles.size, 2);
    {
      const result = await deflator.transform("/tmp/qux", inline("qux"));
      good(result) && ok("storedData" in result);
    }
    deepStrictEqual(store.handles.size, 3);
    await store.close();
    deepStrictEqual(store.handles.size, 0);
  });
});
