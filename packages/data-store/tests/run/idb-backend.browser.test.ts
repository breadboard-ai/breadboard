/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from "@esm-bundle/chai";
import { IDBBackend } from "../../src/file-system/idb-backend.js";
import { LLMContent } from "@breadboard-ai/types";
import { FileSystemQueryResult, Outcome } from "@google-labs/breadboard";

const url = "http://www.example.com";

function bad<T>(o: Outcome<T>) {
  expect(
    o && typeof o === "object" && "$error" in o,
    "outcome must be an error"
  ).to.be.ok;
}

function good<T>(o: Outcome<T>): o is T {
  const error = o && typeof o === "object" && "$error" in o && o.$error;
  expect(!error, error as string).to.be.ok;
  return !error;
}

function justPaths(q: FileSystemQueryResult) {
  return good(q) && q.entries.map((entry) => entry.path);
}

function makeCx(...items: string[]): LLMContent[] {
  return items.map((text) => ({ parts: [{ text }] }));
}

describe("IDB Backend", () => {
  beforeEach(async () => {
    const backend = new IDBBackend(url);
    await backend.clear();
  });

  it("supports read/write/query", async () => {
    const backend = new IDBBackend(url);

    const appending = await backend.append("/local/foo", makeCx("foo"));
    good(appending);

    const reading = await backend.read("/local/foo");
    good(reading) && expect(reading).to.deep.equal(makeCx("foo"));

    const appendingMore = await backend.append("/local/foo", makeCx("more"));
    good(appendingMore);

    const readingMore = await backend.read("/local/foo");
    good(readingMore) &&
      expect(readingMore).to.deep.equal(makeCx("foo", "more"));

    const writingBar = await backend.append("/local/bar", makeCx("bar"));
    good(writingBar);

    const readingBar = await backend.read("/local/bar");
    good(readingBar) && expect(readingBar).to.deep.equal(makeCx("bar"));

    const querying = await backend.query("/local/");
    good(querying) &&
      expect(justPaths(querying)).to.deep.equal(["/local/bar", "/local/foo"]);
  });

  it("handles not found error", async () => {
    const backend = new IDBBackend(url);
    bad(await backend.read("/local/foo"));
  });

  it("supports copy", async () => {
    const backend = new IDBBackend(url);

    const writingFoo = await backend.append("/local/foo", makeCx("foo"));
    good(writingFoo);

    const copying = await backend.copy("/local/foo", "/local/bar/test");
    good(copying);

    const querying = await backend.query("/local/");
    good(querying) &&
      expect(justPaths(querying)).to.deep.equal([
        "/local/bar/test",
        "/local/foo",
      ]);

    const readingBar = await backend.read("/local/bar/test");
    good(readingBar) && expect(readingBar).to.deep.equal(makeCx("foo"));
  });

  it("supports delete", async () => {
    const backend = new IDBBackend(url);

    const writingFoo = await backend.append("/local/foo", makeCx("foo"));
    good(writingFoo);

    const copying = await backend.copy("/local/foo", "/local/bar/test");
    good(copying);

    const copying2 = await backend.copy("/local/foo", "/local/foo2");
    good(copying2);

    const writingBaz = await backend.append("/local/baz", makeCx("baz"));
    good(writingBaz);

    const beforeDelete = await backend.query("/local/");
    good(beforeDelete) &&
      expect(justPaths(beforeDelete)).to.deep.equal([
        "/local/bar/test",
        "/local/baz",
        "/local/foo",
        "/local/foo2",
      ]);

    const deletingFoo = await backend.delete("/local/foo", false);
    good(deletingFoo);

    const afterDeletingFoo = await backend.query("/local/");
    good(afterDeletingFoo) &&
      expect(justPaths(afterDeletingFoo)).to.deep.equal([
        "/local/bar/test",
        "/local/baz",
        "/local/foo2",
      ]);

    const deletingAll = await backend.delete("/local/", true);
    good(deletingAll);

    const afterDeletingAll = await backend.query("/local/");
    good(afterDeletingAll) &&
      expect(justPaths(afterDeletingAll)).to.deep.equal([]);
  });

  it("supports multiple URLs", async () => {
    const backend1 = new IDBBackend(url);
    const backend2 = new IDBBackend("https://example.com/foo");
    const backend3 = new IDBBackend(url);

    const writingFoo = await backend1.append("/local/foo", makeCx("foo"));
    good(writingFoo);

    const writingBaz = await backend2.append("/local/baz", makeCx("baz"));
    good(writingBaz);

    const querying1 = await backend1.query("/local/");
    good(querying1) &&
      expect(justPaths(querying1)).to.deep.equal(["/local/foo"]);

    const querying2 = await backend2.query("/local/");
    good(querying2) &&
      expect(justPaths(querying2)).to.deep.equal(["/local/baz"]);

    const querying3 = await backend3.query("/local/");
    good(querying3) &&
      expect(justPaths(querying3)).to.deep.equal(["/local/foo"]);
  });

  it("supports transactions", async () => {
    const backend = new IDBBackend(url);

    const writingFoo = await backend.append("/local/foo", makeCx("foo"));
    good(writingFoo);

    const txing = await backend.transaction(async (tx) => {
      const readingFoo = await tx.read("/local/foo");
      good(readingFoo) && expect(readingFoo).to.deep.equal(makeCx("foo"));

      const deletingFoo = await tx.delete("/local/foo", false);
      good(deletingFoo);
    });
    good(txing);

    const querying = await backend.query("/local/");
    good(querying) && expect(justPaths(querying)).to.deep.equal([]);
  });
});
