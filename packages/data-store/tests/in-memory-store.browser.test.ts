/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssertionError, expect } from "@esm-bundle/chai";
import { getDefaultDataStore } from "../src/index.js";
import { isSerializedData } from "@google-labs/breadboard";

it("InMemoryStore stores blobs", async () => {
  const store = getDefaultDataStore();
  const url = await store.store(new Blob(["file contents"]));
  store.releaseAll();

  expect(url).to.be.ok;
});

it("InMemoryStore retrieves inline data", async () => {
  const store = getDefaultDataStore();
  const contents = "file contents";
  const type = "text/plain";
  const data = new Blob([contents], { type });
  const url = await store.store(data);
  const retrieved = await store.retrieve(url);
  store.releaseAll();

  expect(atob(retrieved.inlineData.data)).to.deep.equal(
    contents,
    "Contents do not match"
  );
  expect(retrieved.inlineData.mimeType).to.deep.equal(
    type,
    "Types do not match"
  );
});

it("InMemoryStore retrieves blobs", async () => {
  const store = getDefaultDataStore();
  const originalContent = "file contents";
  const data = new Blob([originalContent], { type: "text/plain" });
  const url = await store.store(data);
  const retrieved = await store.retrieveAsBlob(url);
  const retrievedContent = await retrieved.text();
  store.releaseAll();

  expect(retrievedContent).to.equal(originalContent, "Blobs do not match");
});

it("InMemoryStore retrieves urls", async () => {
  const store = getDefaultDataStore();
  const data = new Blob(["file contents"]);
  const stored = await store.store(data);
  const url = await store.retrieveAsURL(stored);
  store.releaseAll();

  expect(typeof url === "string" && url.startsWith("blob:")).to.be.ok;
});

it("InMemoryStore throws if item does not exist", async () => {
  const store = getDefaultDataStore();
  try {
    await store.retrieve({
      storedData: {
        handle: "fakeHandle",
        mimeType: "image/jpeg",
      },
    });
    expect.fail("Should have thrown an error");
  } catch (err) {
    expect(err).to.be.instanceOf(AssertionError);
  }
});

it("InMemoryStore serializes a group", async () => {
  const store = getDefaultDataStore();
  store.startGroup();

  const data1 = new Blob(["file contents 1"]);
  const data2 = new Blob(["file contents 2"]);

  await Promise.all([store.store(data1), store.store(data2)]);

  const group = store.endGroup();
  const serialized = await store.serializeGroup(group);
  store.releaseAll();

  if (serialized === null) {
    expect.fail("Serialization failed");
  } else {
    serialized.every((item) => {
      expect(isSerializedData(item)).to.be.ok;
    });
  }
});

it("InMemoryStore returns null if a group does not exist", async () => {
  const store = getDefaultDataStore();
  const group = await store.serializeGroup(100);
  expect(group).to.not.be.ok;
});

it("InMemoryStore copies to newest group", async () => {
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
    expect.fail("Serialization failed");
  } else {
    expect(serialized.length).to.equal(1);
    serialized.every((item) => {
      expect(isSerializedData(item)).to.be.ok;
    });

    const retrieved = await store.retrieve(newStored);
    expect(atob(retrieved.inlineData.data)).to.deep.equal(
      contents,
      "Contents do not match"
    );
    expect(retrieved.inlineData.mimeType).to.deep.equal(
      type,
      "Types do not match"
    );
  }

  store.releaseAll();
});

it("InMemoryStore drops all entries", async () => {
  const store = getDefaultDataStore();

  const data1 = new Blob(["file contents 1"]);
  const data2 = new Blob(["file contents 2"]);

  const [stored1, stored2] = await Promise.all([
    store.store(data1),
    store.store(data2),
  ]);

  await store.drop();

  try {
    await store.retrieve(stored1);
    expect.fail("Should have thrown an error");
  } catch (err) {
    expect(err).to.be.instanceOf(Error);
  }

  try {
    await store.retrieve(stored2);
    expect.fail("Should have thrown an error");
  } catch (err) {
    expect(err).to.be.instanceOf(Error);
  }
});
