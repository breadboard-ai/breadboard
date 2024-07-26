/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { getDefaultDataStore } from "../../src/index.js";
import { isSerializedData } from "@google-labs/breadboard";

test("InMemoryStore stores blobs", async (t) => {
  const store = getDefaultDataStore();
  const url = await store.store(new Blob(["file contents"]));
  store.releaseAll();

  t.truthy(url, "Failed to store blob");
});

test("InMemoryStore retrieves inline data", async (t) => {
  const store = getDefaultDataStore();
  const contents = "file contents";
  const type = "text/plain";
  const data = new Blob([contents], { type });
  const url = await store.store(data);
  const retrieved = await store.retrieve(url);
  store.releaseAll();

  t.is(atob(retrieved.inlineData.data), contents, "Contents do not match");
  t.is(retrieved.inlineData.mimeType, type, "Types do not match");
});

test("InMemoryStore retrieves blobs", async (t) => {
  const store = getDefaultDataStore();
  const data = new Blob(["file contents"]);
  const url = await store.store(data);
  const retrieved = await store.retrieveAsBlob(url);
  store.releaseAll();

  t.deepEqual(data, retrieved, "Blobs do not match");
});

test("InMemoryStore retrieves urls", async (t) => {
  const store = getDefaultDataStore();
  const data = new Blob(["file contents"]);
  const stored = await store.store(data);
  const url = await store.retrieveAsURL(stored);
  store.releaseAll();

  t.truthy(typeof url === "string" && url.startsWith("blob:"));
});

test("InMemoryStore throws if item does not exist", async (t) => {
  const store = getDefaultDataStore();
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
  const store = getDefaultDataStore();
  store.startGroup();

  const data1 = new Blob(["file contents 1"]);
  const data2 = new Blob(["file contents 2"]);

  await Promise.all([store.store(data1), store.store(data2)]);

  const group = store.endGroup();
  const serialized = await store.serializeGroup(group);
  store.releaseAll();

  if (serialized === null) {
    t.fail("Serialization failed");
  } else {
    serialized.every((item) => {
      t.assert(isSerializedData(item));
    });
  }
});

test("InMemoryStore returns null if a group does not exist", async (t) => {
  const store = getDefaultDataStore();
  const group = await store.serializeGroup(100);
  t.falsy(group);
});

test("InMemoryStore copies to newest group", async (t) => {
  const store = getDefaultDataStore();
  const contents = "file contents 1";
  const type = "text/plain";

  store.startGroup();
  const data1 = new Blob([contents], { type });
  const stored = await store.store(data1);
  store.endGroup();

  store.startGroup();
  const newStored = await store.copyToNewestGroup(stored);
  const group = store.endGroup();

  const serialized = await store.serializeGroup(group);
  if (serialized === null) {
    t.fail("Serialization failed");
  } else {
    t.assert(serialized.length === 1);
    serialized.every((item) => {
      t.assert(isSerializedData(item));
    });

    const retrieved = await store.retrieve(newStored);
    t.is(atob(retrieved.inlineData.data), contents, "Contents do not match");
    t.is(retrieved.inlineData.mimeType, type, "Types do not match");
  }

  store.releaseAll();
});

test("InMemoryStore drops all entries", async (t) => {
  const store = getDefaultDataStore();

  const data1 = new Blob(["file contents 1"]);
  const data2 = new Blob(["file contents 2"]);

  const [stored1, stored2] = await Promise.all([
    store.store(data1),
    store.store(data2),
  ]);

  await store.drop();

  await t.throwsAsync(store.retrieve(stored1));
  await t.throwsAsync(store.retrieve(stored2));
});
