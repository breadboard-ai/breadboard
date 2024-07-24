/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { getDataStore } from "../src/index.js";
import { DataStore, isSerializedData } from "@google-labs/breadboard";

let store: DataStore;
test.beforeEach("Get store", () => {
  store = getDataStore();
});

test.afterEach("Release store", () => {
  store.releaseAll();
});

test("InMemoryStore stores blobs", async (t) => {
  const url = await store.store(new Blob(["file contents"]));
  t.truthy(url, "Failed to store blob");
});

test("InMemoryStore retrieves inline data", async (t) => {
  const contents = "file contents";
  const type = "text/plain";
  const data = new Blob([contents], { type });
  const url = await store.store(data);
  const retrieved = await store.retrieve(url);

  t.is(atob(retrieved.inlineData.data), contents, "Contents do not match");
  t.is(retrieved.inlineData.mimeType, type, "Types do not match");
});

test("InMemoryStore retrieves blobs", async (t) => {
  const data = new Blob(["file contents"]);
  const url = await store.store(data);
  const retrieved = await store.retrieveAsBlob(url);

  t.deepEqual(data, retrieved, "Blobs do not match");
});

test("InMemoryStore retrieves urls", async (t) => {
  const data = new Blob(["file contents"]);
  const stored = await store.store(data);
  const url = await store.retrieveAsURL(stored);

  t.truthy(typeof url === "string" && url.startsWith("blob:"));
});

test("InMemoryStore throws if item does not exist", async (t) => {
  await t.throwsAsync(
    store.retrieve({
      storedData: {
        handle: "fakeHandle",
        mimeType: "image/jpeg",
      },
    })
  );
});

test("InMemoryStore serializes a group", async (t) => {
  store.startGroup();

  const data1 = new Blob(["file contents 1"]);
  const data2 = new Blob(["file contents 2"]);

  await Promise.all([store.store(data1), store.store(data2)]);

  const group = store.endGroup();
  const serialized = await store.serializeGroup(group);

  if (serialized === null) {
    t.fail("Serialization failed");
  } else {
    serialized.every((item) => {
      t.assert(isSerializedData(item));
    });
  }
});

test("InMemoryStore returns null if a group does not exist", async (t) => {
  const group = await store.serializeGroup(100);
  t.falsy(group);
});
